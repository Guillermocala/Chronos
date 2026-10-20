import { weekday, type ISODate } from "@/lib/dates";

import type { BackupMode, Manifest } from "./types";

export type ProjectChange = {
  project_id: string;
  code_prefix: string;
  name: string;
  last_change_at: string;
};

export type BackupPlan = {
  mode: BackupMode;
  exportIds: string[];
  skipped: { project_id: string; slug: string; since: string }[];
};

export function projectSlug(codePrefix: string): string {
  return codePrefix.toLowerCase();
}

/** El backup programado del primer domingo de cada mes es completo. */
export function resolveMode(requested: BackupMode | "auto", today: ISODate): BackupMode {
  if (requested !== "auto") return requested;
  const day = Number(today.slice(8, 10));
  return weekday(today) === 0 && day <= 7 ? "full" : "incremental";
}

/**
 * Qué proyectos exportar: en incremental, solo los nuevos o con cambios desde el
 * último backup (según last_change_at del manifest); en completo, todos.
 */
export function planBackup(
  projects: ProjectChange[],
  manifest: Manifest | null,
  mode: BackupMode,
): BackupPlan {
  const plan: BackupPlan = { mode, exportIds: [], skipped: [] };
  for (const p of projects) {
    const previous = manifest?.projects[p.project_id];
    const unchanged =
      previous !== undefined &&
      previous.last_change_at === p.last_change_at &&
      previous.slug === projectSlug(p.code_prefix);
    if (mode === "incremental" && unchanged) {
      plan.skipped.push({ project_id: p.project_id, slug: previous.slug, since: p.last_change_at.slice(0, 10) });
    } else {
      plan.exportIds.push(p.project_id);
    }
  }
  return plan;
}
