import { FlameIcon, ShieldIcon, SwordsIcon, TrophyIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { GoalDialog } from "@/components/quests/goal-dialog";
import { Meter } from "@/components/quests/meter";
import { MissionDoneItem } from "@/components/quests/mission-done-item";
import { MonthChart, WeeksChart } from "@/components/quests/progress-charts";
import { QuestSettingsDialog } from "@/components/quests/settings-dialog";
import { QuickAddDialog } from "@/components/tasks/quick-add-dialog";
import { TaskList } from "@/components/tasks/task-list";
import { VoiceDictation } from "@/components/voice/voice-dictation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { addDays, todayCO, type ISODate } from "@/lib/dates";
import { listProjectRates } from "@/lib/data/projects";
import { getQuestPage, type MissionView } from "@/lib/data/quests";
import type { TaskWithProject } from "@/lib/data/tasks";
import { formatCOP, plural } from "@/lib/format";
import { ACHIEVEMENTS } from "@/lib/quests/achievements";
import { activeGoal, periodRange, type GoalProgress } from "@/lib/quests/goals";
import type { Reward } from "@/lib/quests/reward";
import { formatDuration } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Misiones · Chronos" };

export default function QuestsPage({ searchParams }: PageProps<"/quests">) {
  return (
    <Suspense fallback={<QuestsSkeleton />}>
      <QuestsContent searchParams={searchParams} />
    </Suspense>
  );
}

const shortDate = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtDate = (iso: ISODate) => shortDate.format(new Date(`${iso}T00:00:00Z`)).replace(".", "");
const unlockedFmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" });

const BOARD_GROUPS: { key: MissionView["group"]; title: string }[] = [
  { key: "overdue", title: "Vencidas" },
  { key: "myDay", title: "Mi día" },
  { key: "dueToday", title: "Vencen hoy" },
];

async function QuestsContent({ searchParams }: Pick<PageProps<"/quests">, "searchParams">) {
  await requireUser();
  const today = todayCO();
  const [{ state, settings, goals, unlocked, missions }, projects, params] = await Promise.all([
    getQuestPage(today),
    listProjectRates(),
    searchParams,
  ]);

  const open = missions.filter((m) => !m.done);
  const doneToday = missions.filter((m) => m.done);
  const atStake = open.reduce((sum, m) => sum + m.reward.cop, 0);
  // Horas del día: lo planeado (estimado de pendientes + completadas) frente a lo real de lo completado.
  const pendingHours = open.reduce((sum, m) => sum + (m.estimatedHours ?? 0), 0);
  const doneEstimate = doneToday.reduce((sum, m) => sum + (m.estimatedHours ?? 0), 0);
  const doneReal = doneToday.reduce((sum, m) => sum + m.realHours, 0);
  const rewards: Record<string, Reward> = Object.fromEntries(open.map((m) => [m.id, m.reward]));
  const { todayTotals: day, streak, boss, week, month } = state;
  const dayTotal = Math.max(day.min, open.length + day.count);

  const weekGoal = activeGoal(goals, "week", periodRange("week", today).start);
  const monthGoal = activeGoal(goals, "month", periodRange("month", today).start);

  const weeksData = state.weeks.map((w) => ({ label: fmtDate(w.week), earned: w.earned, target: w.target, defeated: w.defeated }));
  const monthData = state.monthDaily.map((p) => ({ label: String(Number(p.date.slice(8))), earned: p.earned, expected: p.expected }));

  return (
    <>
      <PageHeader
        title="Misiones"
        description="Termina tus tareas, sube tu racha y derrota al jefe de la semana."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <QuestSettingsDialog settings={settings} />
            <VoiceDictation projects={projects} today={today} defaultMyDay defaultOpen={params.dictate === "1"} />
            <QuickAddDialog defaultMyDay defaultOpen={params.add === "1"} />
          </div>
        }
      />

      {/* Encabezado de jugador: racha, hoy y jefe */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Tu partida">
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <FlameIcon className={cn("size-4", streak.current > 0 ? "text-orange-500" : "text-muted-foreground")} aria-hidden />
              Racha
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{plural(streak.current, "día", "días")}</CardTitle>
            <CardDescription>
              Mejor: {plural(streak.best, "día", "días")} ·{" "}
              {streak.freezeAvailable ? (
                <span title="Cubre un día laborable fallado esta semana">🧊 comodín disponible</span>
              ) : (
                <span>comodín usado esta semana</span>
              )}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Hoy</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatCOP(day.earned)}</CardTitle>
            <CardDescription>
              {day.goalMet ? "✅ Día cumplido" : `${day.count} de ${day.min} misiones para cumplir el día`}
              {atStake > 0 && <> · {formatCOP(atStake)} en juego</>}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Meter value={day.count} max={dayTotal} label="Misiones de hoy" tone={day.goalMet ? "success" : "primary"} />
            {(pendingHours > 0 || doneReal > 0 || doneEstimate > 0) && (
              <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground tabular-nums">
                {pendingHours > 0 && <span>⏳ ~{formatDuration(pendingHours)} por hacer</span>}
                {(doneReal > 0 || doneEstimate > 0) && (
                  <span className={cn(doneEstimate > 0 && doneReal > doneEstimate + 0.005 && "text-destructive")}>
                    ⏱️ {formatDuration(doneReal)} reales
                    {doneEstimate > 0 && ` de ~${formatDuration(doneEstimate)} estimadas`}
                  </span>
                )}
              </p>
            )}
          </CardContent>
        </Card>

        <Card size="sm" className="sm:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <SwordsIcon className="size-4" aria-hidden />
              Jefe de la semana
            </CardDescription>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span aria-hidden className={cn("text-2xl", boss.state === "defeated" && "grayscale")}>
                {boss.emoji}
              </span>
              <span className={cn(boss.state === "defeated" && "line-through decoration-2")}>{boss.name}</span>
            </CardTitle>
            <CardDescription>
              {boss.state === "none"
                ? "Define una meta semanal para invocarlo."
                : boss.state === "defeated"
                  ? `¡Derrotado! Le hiciste ${formatCOP(boss.damage)} de daño.`
                  : `Le quedan ${formatCOP(boss.hp)} de vida (${100 - boss.pct} %).`}
            </CardDescription>
          </CardHeader>
          {boss.state !== "none" && (
            <CardContent>
              <Meter
                value={boss.hp}
                max={boss.maxHp}
                label={`Vida de ${boss.name}`}
                tone={boss.state === "defeated" ? "success" : boss.state === "wounded" ? "gold" : "danger"}
              />
            </CardContent>
          )}
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Misiones del día */}
        <section className="flex min-w-0 flex-col gap-4" aria-labelledby="missions-title">
          <div className="flex items-center gap-2">
            <h2 id="missions-title" className="text-base font-semibold">
              Misiones de hoy
            </h2>
            <Badge variant="secondary">{open.length}</Badge>
          </div>
          {open.length === 0 && doneToday.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShieldIcon />
                </EmptyMedia>
                <EmptyTitle>Sin misiones para hoy</EmptyTitle>
                <EmptyDescription>
                  Agrega tareas a Mi día (con horas estimadas, ~2h) para ver cuánto ganas con cada una.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              {BOARD_GROUPS.map((group) => {
                const items = open.filter((m) => m.group === group.key);
                if (items.length === 0) return null;
                const value = items.reduce((s, m) => s + m.reward.cop, 0);
                return (
                  <div key={group.key} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{group.title}</h3>
                      <Badge variant={group.key === "overdue" ? "destructive" : "secondary"}>{items.length}</Badge>
                      {value > 0 && <span className="text-xs text-muted-foreground">{formatCOP(value)}</span>}
                    </div>
                    <TaskList
                      tasks={items.map((m) => m.task as TaskWithProject)}
                      today={today}
                      projects={projects}
                      rewards={rewards}
                    />
                  </div>
                );
              })}
              {open.length === 0 && (
                <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  🎉 No quedan misiones pendientes hoy.
                </p>
              )}
              {doneToday.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">Completadas hoy</h3>
                    <Badge variant="secondary">{doneToday.length}</Badge>
                    {day.earned > 0 && <span className="text-xs text-muted-foreground">{formatCOP(day.earned)}</span>}
                  </div>
                  <ul className="flex flex-col">
                    {doneToday.map((m) => (
                      <MissionDoneItem key={m.id} id={m.id} title={m.title} project={m.project} reward={m.reward} />
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>

        {/* Metas */}
        <section className="flex min-w-0 flex-col gap-3" aria-labelledby="goals-title">
          <h2 id="goals-title" className="text-base font-semibold">
            Metas
          </h2>
          <GoalCard
            title="Semana"
            period="week"
            progress={week}
            current={weekGoal}
            suggestion={monthGoal ? Math.round(monthGoal.target_cop / 4.3 / 1000) * 1000 : null}
          />
          <GoalCard
            title="Temporada (mes)"
            period="month"
            progress={month}
            current={monthGoal}
            suggestion={weekGoal ? Math.round((weekGoal.target_cop * 4.3) / 1000) * 1000 : null}
          />
        </section>
      </div>

      {/* Progreso */}
      <section className="grid gap-6 lg:grid-cols-2" aria-label="Progreso">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas semanas</CardTitle>
            <CardDescription>Ganado por semana; en color fuerte, las semanas con el jefe derrotado.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <WeeksChart data={weeksData} />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Semana</TableHead>
                  <TableHead className="text-right">Ganado</TableHead>
                  <TableHead className="text-right">Meta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...state.weeks].reverse().map((w) => (
                  <TableRow key={w.week}>
                    <TableCell>
                      {fmtDate(w.week)} – {fmtDate(addDays(w.week, 6))} {w.defeated && <span aria-label="jefe derrotado">⚔️</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCOP(w.earned)}</TableCell>
                    <TableCell className="text-right tabular-nums">{w.target ? formatCOP(w.target) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Este mes</CardTitle>
            <CardDescription>
              {month
                ? "Acumulado frente al ritmo esperado para llegar a la meta."
                : "Define una meta mensual para ver el ritmo esperado."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <MonthChart data={monthData} target={month?.target ?? null} />
            {month && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Acumulado</dt>
                <dd className="text-right tabular-nums">{formatCOP(month.earned)}</dd>
                <dt className="text-muted-foreground">Deberías llevar</dt>
                <dd className="text-right tabular-nums">{formatCOP(month.expected)}</dd>
                <dt className="text-muted-foreground">Proyección al cierre</dt>
                <dd className="text-right tabular-nums">{formatCOP(month.projection)}</dd>
              </dl>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Logros */}
      <section className="flex flex-col gap-3" aria-labelledby="achievements-title">
        <div className="flex items-center gap-2">
          <TrophyIcon className="size-4 text-amber-500" aria-hidden />
          <h2 id="achievements-title" className="text-base font-semibold">
            Logros
          </h2>
          <Badge variant="secondary">
            {unlocked.size} / {ACHIEVEMENTS.length}
          </Badge>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ACHIEVEMENTS.map((a) => {
            const at = unlocked.get(a.code);
            return (
              <li
                key={a.code}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3",
                  at ? "border-amber-500/40 bg-amber-500/5" : "opacity-60",
                )}
              >
                <span aria-hidden className={cn("text-2xl leading-none", !at && "grayscale")}>
                  {at ? a.emoji : "🔒"}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium break-words">{a.title}</span>
                  <span className="text-xs text-muted-foreground break-words">
                    {at ? `Desbloqueado el ${unlockedFmt.format(new Date(at))}` : a.hint}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function GoalCard({
  title,
  period,
  progress,
  current,
  suggestion,
}: {
  title: string;
  period: "week" | "month";
  progress: GoalProgress | null;
  current: { target_cop: number; target_tasks: number | null } | null;
  suggestion: number | null;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <CardDescription>
              {title}
              {progress && ` · ${fmtDate(progress.range.start)} – ${fmtDate(progress.range.end)}`}
            </CardDescription>
            <CardTitle className="text-lg tabular-nums [overflow-wrap:anywhere]">
              {progress ? (
                <>
                  {formatCOP(progress.earned)} <span className="text-sm font-normal text-muted-foreground">de {formatCOP(progress.target)}</span>
                </>
              ) : (
                "Sin meta"
              )}
            </CardTitle>
          </div>
          <GoalDialog period={period} current={current} suggestion={suggestion} />
        </div>
      </CardHeader>
      {progress && (
        <CardContent className="flex flex-col gap-2">
          <Meter
            value={progress.earned}
            max={progress.target}
            marker={progress.expected}
            label={`Meta ${period === "week" ? "semanal" : "mensual"}`}
            tone={progress.ratio >= 1 ? "success" : progress.diff >= 0 ? "primary" : "gold"}
          />
          <p className="text-sm">
            {progress.ratio >= 1 ? (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">🏆 ¡Meta cumplida! ({Math.round(progress.ratio * 100)} %)</span>
            ) : progress.diff >= 0 ? (
              <span>
                Vas <strong>{formatCOP(progress.diff)}</strong> adelante del ritmo ({Math.round(progress.ratio * 100)} %).
              </span>
            ) : (
              <span>
                Vas <strong>{formatCOP(-progress.diff)}</strong> atrás del ritmo ({Math.round(progress.ratio * 100)} %).
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {progress.ratio < 1 && progress.workDaysLeft > 0 && (
              <>
                Faltan {formatCOP(progress.remaining)}: {formatCOP(progress.perDayNeeded)} por día laborable (
                {plural(progress.workDaysLeft, "día", "días")}).{" "}
              </>
            )}
            Proyección: {formatCOP(progress.projection)}.
            {progress.targetTasks != null && <> Misiones: {progress.tasksDone} de {progress.targetTasks}.</>}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

function QuestsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-40" />
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
