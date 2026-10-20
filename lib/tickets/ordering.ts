// Orden del kanban con posiciones fraccionales: mover una tarjeta solo cambia
// su propia posición (el punto medio entre sus vecinas), sin renumerar la columna.

export const POSITION_STEP = 1000;
const MIN_GAP = 1e-6;

/** Posición para colocar algo entre `before` y `after` (null = extremo de la lista). */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return POSITION_STEP;
  if (before === null) return after! - POSITION_STEP;
  if (after === null) return before + POSITION_STEP;
  return (before + after) / 2;
}

/** true si las vecinas quedaron tan juntas que conviene renumerar la columna. */
export function needsRebalance(before: number | null, after: number | null): boolean {
  return before !== null && after !== null && after - before < MIN_GAP;
}

/** Posiciones limpias (1000, 2000, …) conservando el orden dado. */
export function rebalance(ids: string[]): Map<string, number> {
  return new Map(ids.map((id, i) => [id, (i + 1) * POSITION_STEP]));
}
