import "server-only";

import { requireUser } from "@/lib/auth";
import type { ISODate } from "@/lib/dates";
import { dateInBogota } from "@/lib/reports/hours";
import { listTodayCandidates, type TaskWithProject } from "@/lib/data/tasks";
import { newlyUnlocked } from "@/lib/quests/achievements";
import type { QuestGoal } from "@/lib/quests/goals";
import { isMission, makeRewardResolver, type Reward } from "@/lib/quests/reward";
import { buildQuestState, type QuestState } from "@/lib/quests/state";
import { DEFAULT_QUEST_SETTINGS, type QuestSettings } from "@/lib/quests/streak";
import { groupTodayTasks } from "@/lib/tasks/today";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

const PAGE = 1000;

/** PostgREST devuelve máximo 1000 filas por consulta: lee por páginas. */
async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) return all;
  }
}

const DONE_SELECT =
  "id, title, status, completed_at, planned_on, estimated_hours, project_id, ticket_id, kind, auto_source, priority, logged:time_entries(hours, deleted_at), project:projects(id, name, code_prefix, color)";

export type MissionView = {
  id: string;
  title: string;
  done: boolean;
  priority: number;
  group: "overdue" | "myDay" | "dueToday" | "done";
  project: TaskWithProject["project"];
  reward: Reward;
  task?: TaskWithProject;
};

export type QuestData = {
  state: QuestState;
  settings: QuestSettings;
  goals: QuestGoal[];
  unlocked: Map<string, string>;
  resolve: ReturnType<typeof makeRewardResolver>;
};

/** Proyectos (con su facturación) y tickets: lo necesario para calcular el valor de cualquier tarea. */
async function loadResolver(supabase: Supabase) {
  const [projects, scope, tickets] = await Promise.all([
    readAll((from, to) =>
      supabase
        .from("projects")
        .select("id, billing_type, fixed_amount_cop, estimated_total_hours, monthly_fee_cop, expected_hours_per_month, contract_months")
        .order("id")
        .range(from, to),
    ),
    readAll((from, to) => supabase.from("project_hours").select("project_id, scope_estimated").range(from, to)),
    readAll((from, to) =>
      supabase.from("tickets").select("id, kind, billable, estimated_hours").order("id").range(from, to),
    ),
  ]);
  const scopeById = new Map(scope.map((s) => [s.project_id, s.scope_estimated]));
  return makeRewardResolver({
    projects: projects.map((p) => ({ ...p, scope_estimated: scopeById.get(p.id) ?? null })),
    tickets,
  });
}

/** Valor de cada tarea por id (chip "+$X" en Hoy). Si falla, no muestra chips. */
export async function getTaskRewards(tasks: TaskWithProject[]): Promise<Record<string, Reward>> {
  try {
    const { supabase } = await requireUser();
    const resolve = await loadResolver(supabase);
    return Object.fromEntries(tasks.filter(isMission).map((t) => [t.id, resolve(t)]));
  } catch {
    return {};
  }
}

/** Todo lo que el juego necesita: historial de misiones, valor de cada una, ajustes, metas y logros. */
async function loadQuestData(supabase: Supabase, today: ISODate): Promise<QuestData & { doneToday: MissionView[] }> {
  const [resolve, done, settingsRow, goals, achievements] = await Promise.all([
    loadResolver(supabase),
    readAll((from, to) =>
      supabase
        .from("tasks")
        .select(DONE_SELECT)
        .is("deleted_at", null)
        .eq("status", "done")
        .eq("kind", "todo")
        .is("auto_source", null)
        .not("completed_at", "is", null)
        .order("completed_at")
        .order("id")
        .range(from, to),
    ),
    supabase.from("quest_settings").select("daily_min_tasks, work_days").is("deleted_at", null).maybeSingle(),
    supabase.from("quest_goals").select("period, target_cop, target_tasks, effective_from").is("deleted_at", null),
    supabase.from("quest_achievements").select("code, unlocked_at").is("deleted_at", null),
  ]);
  if (settingsRow.error) throw settingsRow.error;
  if (goals.error) throw goals.error;
  if (achievements.error) throw achievements.error;

  const settings: QuestSettings = settingsRow.data ?? DEFAULT_QUEST_SETTINGS;
  const questGoals = (goals.data ?? []).map((g) => ({ ...g, target_cop: Number(g.target_cop) })) as QuestGoal[];

  const withReward = done.map((t) => ({ task: t, reward: resolve(t) }));
  const state = buildQuestState({
    done: withReward.map(({ task, reward }) => ({
      completed_at: task.completed_at!,
      cop: reward.cop,
      personal: reward.personal,
    })),
    today,
    settings,
    goals: questGoals,
  });

  const doneToday: MissionView[] = withReward
    .filter(({ task }) => dateInBogota(task.completed_at!) === today)
    .map(({ task, reward }) => ({
      id: task.id,
      title: task.title,
      done: true,
      priority: task.priority,
      group: "done",
      project: task.project,
      reward,
    }));

  return {
    state,
    settings,
    goals: questGoals,
    unlocked: new Map((achievements.data ?? []).map((a) => [a.code, a.unlocked_at])),
    resolve,
    doneToday,
  };
}

export type QuestPage = QuestData & { missions: MissionView[] };

/** Datos de la página Misiones: estado del juego + tablero del día. */
export async function getQuestPage(today: ISODate): Promise<QuestPage> {
  const { supabase } = await requireUser();
  const [data, candidates] = await Promise.all([loadQuestData(supabase, today), listTodayCandidates(today)]);
  const groups = groupTodayTasks(candidates.filter(isMission), today);
  const open: MissionView[] = (["overdue", "myDay", "dueToday"] as const).flatMap((group) =>
    groups[group].map((task) => ({
      id: task.id,
      title: task.title,
      done: false,
      priority: task.priority,
      group,
      project: task.project,
      reward: data.resolve(task),
      task,
    })),
  );
  return { ...data, missions: [...open, ...data.doneToday] };
}

export type QuestEvent = {
  reward: Reward | null;
  unlocked: string[];
  bossDefeated: string | null;
  dayGoalMet: boolean;
  streak: number;
};

/**
 * Tras completar una tarea: su valor, logros nuevos (se guardan una sola vez),
 * si derrotó al jefe o cumplió el día. Si algo falla, no bloquea la acción.
 */
export async function evaluateQuestProgress(supabase: Supabase, taskId: string, today: ISODate): Promise<QuestEvent | null> {
  try {
    const data = await loadQuestData(supabase, today);
    const justDone = data.doneToday.find((m) => m.id === taskId);
    if (!justDone) return null;

    const { state } = data;
    const unlocked = newlyUnlocked(state.stats, new Set(data.unlocked.keys()));
    if (unlocked.length) {
      const { error } = await supabase
        .from("quest_achievements")
        .upsert(unlocked.map((code) => ({ code })), { onConflict: "user_id,code", ignoreDuplicates: true });
      if (error) unlocked.length = 0;
    }

    const cop = justDone.reward.cop;
    const bossDefeated =
      state.boss.state === "defeated" && cop > 0 && state.boss.damage - cop < state.boss.maxHp ? state.boss.name : null;
    return {
      reward: justDone.reward,
      unlocked,
      bossDefeated,
      dayGoalMet: state.todayTotals.count === state.todayTotals.min,
      streak: state.streak.current,
    };
  } catch {
    return null;
  }
}
