"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, failIssue, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { todayCO } from "@/lib/dates";
import { formatCOP, parseCOP } from "@/lib/format";
import { periodRange } from "@/lib/quests/goals";

const goalSchema = z.object({
  period: z.enum(["week", "month"]),
  target_cop: z.preprocess(
    (v) => (typeof v === "string" ? parseCOP(v) : v),
    z.number({ error: "Escribe la meta en pesos." }).int().positive("La meta debe ser mayor que 0.").max(10_000_000_000),
  ),
  target_tasks: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().int().positive("Las misiones deben ser más de 0.").max(1000).nullable(),
  ),
});

/** Define la meta de la semana o el mes en curso (las pasadas conservan la suya). */
export async function saveGoal(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = goalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failIssue(parsed.error);
  const { period, target_cop, target_tasks } = parsed.data;

  const { error } = await supabase.from("quest_goals").upsert(
    {
      period,
      target_cop,
      target_tasks,
      effective_from: periodRange(period, todayCO()).start,
      deleted_at: null,
    },
    { onConflict: "user_id,period,effective_from" },
  );
  if (error) return fail("No se pudo guardar la meta.");

  revalidatePath("/quests");
  return ok(`Meta ${period === "week" ? "semanal" : "mensual"}: ${formatCOP(target_cop)}.`);
}

const settingsSchema = z.object({
  daily_min_tasks: z.coerce
    .number({ error: "Escribe un número." })
    .int()
    .min(1, "Mínimo 1 misión.")
    .max(20, "Máximo 20 misiones."),
  work_days: z
    .array(z.coerce.number().int().min(0).max(6))
    .min(1, "Elige al menos un día laborable."),
});

export async function saveQuestSettings(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = settingsSchema.safeParse({
    daily_min_tasks: formData.get("daily_min_tasks"),
    work_days: formData.getAll("work_days"),
  });
  if (!parsed.success) return failIssue(parsed.error);

  const { error } = await supabase
    .from("quest_settings")
    .upsert({ ...parsed.data, work_days: [...new Set(parsed.data.work_days)].sort(), deleted_at: null }, { onConflict: "user_id" });
  if (error) return fail("No se pudieron guardar los ajustes.");

  revalidatePath("/quests");
  return ok("Reglas del juego guardadas.");
}
