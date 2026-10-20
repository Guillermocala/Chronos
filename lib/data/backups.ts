import "server-only";

import { requireUser } from "@/lib/auth";
import type { Tables } from "@/lib/supabase/database.types";

export type BackupRun = Tables<"backup_runs">;

/** Ventana en la que una ejecución "running" bloquea lanzar otra (después se asume colgada). */
export const RUNNING_WINDOW_MS = 15 * 60 * 1000;

export function isBackupRunning(runs: Pick<BackupRun, "status" | "started_at">[]): boolean {
  const now = Date.now();
  return runs.some((r) => r.status === "running" && now - new Date(r.started_at).getTime() < RUNNING_WINDOW_MS);
}

export async function listBackupRuns(limit = 20): Promise<BackupRun[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("backup_runs")
    .select("*")
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
