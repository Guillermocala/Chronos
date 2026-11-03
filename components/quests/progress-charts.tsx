"use client";

// Gráficas de Misiones. Mismas reglas que Reportes (skill dataviz): colores por rol
// con --chart-*, rejilla y ejes discretos, leyenda visible y tabla equivalente en
// la página.

import { Bar, CartesianGrid, Cell, ComposedChart, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const copShort = new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 });
const copFull = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

function Row({ name, value, color, config }: { name: unknown; value: unknown; color?: string; config: ChartConfig }) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return (
    <div className="flex w-full items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
      <span className="text-muted-foreground">{config[String(name)]?.label ?? String(name)}</span>
      <span className="ml-auto font-mono font-medium text-foreground tabular-nums">{copFull.format(Number(value))}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Semanas: ganado por semana; las semanas con el jefe derrotado en el color fuerte.

const weeksConfig = {
  earned: { label: "Ganado", color: "var(--chart-1)" },
  target: { label: "Meta", color: "var(--chart-5)" },
} satisfies ChartConfig;

export function WeeksChart({
  data,
}: {
  data: { label: string; earned: number; target: number | null; defeated: boolean }[];
}) {
  return (
    <ChartContainer config={weeksConfig} className="aspect-auto h-56 w-full">
      <ComposedChart data={data} accessibilityLayer margin={{ left: 4, right: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => copShort.format(v)} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => <Row value={value} name={name} color={item.color} config={weeksConfig} />}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="earned" fill="var(--color-earned)" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.label} fillOpacity={d.defeated ? 1 : 0.55} />
          ))}
        </Bar>
        <Line dataKey="target" type="step" stroke="var(--color-target)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
      </ComposedChart>
    </ChartContainer>
  );
}

// ---------------------------------------------------------------------------
// Mes: acumulado frente al ritmo esperado.

const monthConfig = {
  earned: { label: "Acumulado", color: "var(--chart-1)" },
  expected: { label: "Ritmo esperado", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function MonthChart({
  data,
  target,
}: {
  data: { label: string; earned: number | null; expected: number | null }[];
  target: number | null;
}) {
  return (
    <ChartContainer config={monthConfig} className="aspect-auto h-56 w-full">
      <LineChart data={data} accessibilityLayer margin={{ left: 4, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => copShort.format(v)} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => <Row value={value} name={name} color={item.color} config={monthConfig} />}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {target != null && <ReferenceLine y={target} stroke="var(--chart-5)" strokeDasharray="4 4" />}
        <Line dataKey="expected" stroke="var(--color-expected)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
        <Line dataKey="earned" stroke="var(--color-earned)" strokeWidth={2.5} dot={false} connectNulls={false} />
      </LineChart>
    </ChartContainer>
  );
}
