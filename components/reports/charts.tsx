"use client";

// Gráficas de reportes. Reglas (skill dataviz): colores por rol en fijo
// (--chart-*, validados claro/oscuro), barras apiladas con 2px de separación en el
// color de superficie y extremo redondeado de 4px, leyenda siempre visible,
// rejilla y ejes discretos, y tooltip por marca. Cada gráfica va acompañada de
// una tabla equivalente en la página (accesibilidad y contraste).

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const GAP = { stroke: "var(--background)", strokeWidth: 2 } as const;
const copShort = new Intl.NumberFormat("es-CO", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const copFull = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
const hoursFmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

function TooltipRow({
  value,
  name,
  color,
  config,
  format,
}: {
  value: unknown;
  name: unknown;
  color?: string;
  config: ChartConfig;
  format: (n: number) => string;
}) {
  return (
    <div className="flex w-full items-center gap-2">
      <span
        className="size-2.5 shrink-0 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
      <span className="text-muted-foreground">
        {config[String(name)]?.label ?? String(name)}
      </span>
      <span className="ml-auto font-mono font-medium text-foreground tabular-nums">
        {format(Number(value))}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cobros por mes: recibido / pendiente / vencido (apiladas)

const cashflowConfig = {
  received: { label: "Recibido", color: "var(--chart-1)" },
  pending: { label: "Pendiente", color: "var(--chart-3)" },
  overdue: { label: "Vencido", color: "var(--chart-5)" },
} satisfies ChartConfig;

export function CashflowChart({
  data,
}: {
  data: { label: string; received: number; pending: number; overdue: number }[];
}) {
  return (
    <ChartContainer config={cashflowConfig} className="aspect-auto h-64 w-full">
      <BarChart data={data} accessibilityLayer margin={{ left: 4, right: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v) => copShort.format(v)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => (
                <TooltipRow
                  value={value}
                  name={name}
                  color={item.color}
                  config={cashflowConfig}
                  format={(n) => copFull.format(n)}
                />
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="received"
          stackId="a"
          fill="var(--color-received)"
          {...GAP}
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="pending"
          stackId="a"
          fill="var(--color-pending)"
          {...GAP}
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="overdue"
          stackId="a"
          fill="var(--color-overdue)"
          {...GAP}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}

// ---------------------------------------------------------------------------
// Horas por tipo (alcance / soporte / extra): por semana o por proyecto

const hoursConfig = {
  scope: { label: "Alcance", color: "var(--chart-1)" },
  support: { label: "Soporte", color: "var(--chart-2)" },
  extra: { label: "Extra", color: "var(--chart-3)" },
} satisfies ChartConfig;

type HoursRow = {
  label: string;
  scope: number;
  support: number;
  extra: number;
};

export function HoursChart({
  data,
  layout = "vertical-bars",
}: {
  data: HoursRow[];
  layout?: "vertical-bars" | "horizontal";
}) {
  const horizontal = layout === "horizontal";
  return (
    <ChartContainer
      config={hoursConfig}
      className="aspect-auto w-full"
      style={{
        height: horizontal ? Math.max(160, data.length * 40 + 60) : 256,
      }}
    >
      <BarChart
        data={data}
        accessibilityLayer
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ left: 4, right: 4 }}
      >
        <CartesianGrid vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${hoursFmt.format(v)} h`}
            />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              width={80}
              tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 11)}…` : v)}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={36}
              tickFormatter={(v) => hoursFmt.format(v)}
            />
          </>
        )}
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => (
                <TooltipRow
                  value={value}
                  name={name}
                  color={item.color}
                  config={hoursConfig}
                  format={(n) => `${hoursFmt.format(n)} h`}
                />
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="scope"
          stackId="a"
          fill="var(--color-scope)"
          {...GAP}
          radius={0}
        />
        <Bar
          dataKey="support"
          stackId="a"
          fill="var(--color-support)"
          {...GAP}
          radius={0}
        />
        <Bar
          dataKey="extra"
          stackId="a"
          fill="var(--color-extra)"
          {...GAP}
          radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}

// ---------------------------------------------------------------------------
// Burndown: horas estimadas pendientes (real) vs línea ideal (referencia)

const burndownConfig = {
  remaining: { label: "Pendiente real", color: "var(--chart-1)" },
  ideal: { label: "Ideal", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

export function BurndownChart({
  data,
}: {
  data: { label: string; remaining: number | null; ideal: number }[];
}) {
  return (
    <ChartContainer config={burndownConfig} className="aspect-auto h-56 w-full">
      <LineChart
        data={data}
        accessibilityLayer
        margin={{ left: 4, right: 12, top: 8 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={16}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={36}
          tickFormatter={(v) => hoursFmt.format(v)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => (
                <TooltipRow
                  value={value}
                  name={name}
                  color={item.color}
                  config={burndownConfig}
                  format={(n) => `${hoursFmt.format(n)} h`}
                />
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="ideal"
          type="linear"
          stroke="var(--color-ideal)"
          strokeWidth={1}
          dot={false}
          activeDot={false}
        />
        <Line
          dataKey="remaining"
          type="linear"
          stroke="var(--color-remaining)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 2 }}
          connectNulls={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
