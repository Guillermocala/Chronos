import { cn } from "@/lib/utils";

type Props = {
  value: number;
  max: number;
  /** Texto accesible ("Meta semanal"). */
  label: string;
  /** Marca del ritmo esperado (mismo rango que value). */
  marker?: number | null;
  tone?: "primary" | "gold" | "danger" | "success";
  className?: string;
};

const TONES = {
  primary: "bg-primary",
  gold: "bg-amber-500",
  danger: "bg-red-500",
  success: "bg-emerald-500",
} as const;

/** Barra de progreso gruesa con marca opcional del ritmo esperado. */
export function Meter({ value, max, label, marker, tone = "primary", className }: Props) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const markerPct = marker != null && max > 0 ? Math.min((marker / max) * 100, 100) : null;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("relative h-3 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", TONES[tone])}
        style={{ width: `${pct}%` }}
      />
      {markerPct != null && markerPct > 0 && (
        <div
          aria-hidden
          title="Ritmo esperado"
          className="absolute inset-y-0 w-0.5 bg-foreground/70"
          style={{ left: `calc(${markerPct}% - 1px)` }}
        />
      )}
    </div>
  );
}
