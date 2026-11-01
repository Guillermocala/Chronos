"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, failIssue, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { addDays, isISODate, type ISODate } from "@/lib/dates";
import { formatDuration } from "@/lib/time";

const isoDate = z.string().refine(isISODate, "Fecha inválida.");
const source = z.enum(["leden"]);

const SOURCE_LABEL: Record<z.infer<typeof source>, string> = { leden: "Leden" };

const importSchema = z
  .object({
    source,
    meta: z.object({
      code: z.string().max(100).nullable(),
      periodStart: isoDate.nullable(),
      periodEnd: isoDate.nullable(),
      summaryMd: z.string().max(200_000),
    }),
    links: z
      .array(z.object({ externalName: z.string().trim().min(1).max(200), projectId: z.uuid("Elige un proyecto.") }))
      .max(50),
    rows: z
      .array(
        z.object({
          externalId: z.string().min(1).max(1000),
          date: isoDate,
          externalProject: z.string().trim().min(1).max(200),
          title: z.string().trim().min(1, "Hay un registro sin descripción.").max(300),
          notes: z.string().max(1000),
          tags: z.array(z.string().max(40)).max(20),
          hours: z.number().gt(0).max(24, "Un registro no puede pasar de 24 h."),
        }),
      )
      .min(1, "Selecciona al menos un registro.")
      .max(500, "Máximo 500 registros por carga."),
  })
  .refine((d) => new Set(d.rows.map((r) => r.externalId)).size === d.rows.length, "Hay registros repetidos.");

export type ExternalImportPayload = z.input<typeof importSchema>;

/**
 * Carga los registros seleccionados: cada uno queda como tarea hecha en su fecha
 * con sus horas al proyecto mapeado. Los ya cargados se omiten (huella).
 */
export async function importExternal(payload: ExternalImportPayload): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = importSchema.safeParse(payload);
  if (!parsed.success) return failIssue(parsed.error);
  const { source: src, meta, links, rows } = parsed.data;

  const projectOf = new Map(links.map((l) => [l.externalName.toLowerCase(), l.projectId]));
  const missing = [...new Set(rows.map((r) => r.externalProject))].filter((p) => !projectOf.has(p.toLowerCase()));
  if (missing.length > 0) return fail(`Elige el proyecto de Chronos para: ${missing.join(", ")}.`);

  const title = `Informe ${SOURCE_LABEL[src]}${meta.code ? ` ${meta.code}` : ""}`;
  const { data, error } = await supabase.rpc("import_external_activities", {
    p_source: src,
    p_note: { title, meeting_date: meta.periodEnd ?? rows[rows.length - 1].date, content_md: meta.summaryMd },
    p_links: links.map((l) => ({ external_name: l.externalName, project_id: l.projectId })),
    p_rows: rows.map((r) => ({
      external_id: r.externalId,
      date: r.date,
      title: r.title,
      notes: r.notes || null,
      tags: r.tags,
      hours: r.hours,
      project_id: projectOf.get(r.externalProject.toLowerCase()),
    })),
  });
  if (error) {
    return fail(error.message.includes("no encontrado") ? error.message : "No se pudieron cargar los registros.");
  }

  const result = data as { created: number; skipped: number; hours: number };
  revalidatePath("/", "layout");
  if (result.created === 0) return ok("No había registros nuevos: todos ya estaban cargados.");
  const skipped = result.skipped > 0 ? ` ${result.skipped} ya estaban cargados.` : "";
  return ok(
    `Se cargaron ${result.created} ${result.created === 1 ? "actividad" : "actividades"} (${formatDuration(Number(result.hours))}).${skipped}`,
  );
}

const checkSchema = z.object({ source, from: isoDate, to: isoDate });

/** Huellas ya cargadas en el rango de fechas del informe (para marcarlas en la vista previa). */
export async function listLoadedExternalIds(input: z.input<typeof checkSchema>): Promise<string[]> {
  const { supabase } = await requireUser();
  const parsed = checkSchema.safeParse(input);
  if (!parsed.success) return [];
  const { source: src, from, to } = parsed.data;
  // Las tareas cargadas se completan a las 12:00 de su fecha (hora Colombia).
  const { data, error } = await supabase
    .from("tasks")
    .select("external_id")
    .eq("external_source", src)
    .is("deleted_at", null)
    .gte("completed_at", `${from}T00:00:00-05:00`)
    .lt("completed_at", `${addDays(to as ISODate, 1)}T00:00:00-05:00`);
  if (error) return [];
  return data.map((t) => t.external_id).filter((id): id is string => id !== null);
}
