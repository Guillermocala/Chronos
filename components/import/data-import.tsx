"use client";

import { CheckCircle2Icon, FileUpIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { importExternal, listLoadedExternalIds } from "@/app/(app)/import/data-actions";
import type { ProjectOption } from "@/components/granola/dictation-review";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action-toast";
import { formatShortDate } from "@/lib/format";
import { findFormat, IMPORT_FORMATS, type ImportFormatId } from "@/lib/import/formats";
import { normalizeText, slugTag } from "@/lib/import/leden/parse";
import type { ExternalReport, ExternalRow } from "@/lib/import/types";
import { formatDuration } from "@/lib/time";
import { cn } from "@/lib/utils";

type SavedLink = { externalName: string; projectId: string };

type Props = {
  projects: ProjectOption[];
  /** Mapeos guardados por formato. */
  savedLinks: Partial<Record<ImportFormatId, SavedLink[]>>;
  defaultFormat?: string;
};

type Loaded = { report: ExternalReport; fileName: string };

const sumHours = (rows: ExternalRow[]) => Math.round(rows.reduce((s, r) => s + r.hours, 0) * 100) / 100;

/** Proyecto sugerido: el mapeo guardado o un proyecto con el mismo nombre. */
function suggestProject(name: string, links: SavedLink[], projects: ProjectOption[]): string {
  const saved = links.find((l) => l.externalName.toLowerCase() === name.toLowerCase());
  if (saved && projects.some((p) => p.id === saved.projectId)) return saved.projectId;
  const n = normalizeText(name);
  const match = projects.find((p) => {
    const pn = normalizeText(p.name);
    return pn === n || n.startsWith(pn) || pn.startsWith(n);
  });
  return match?.id ?? "";
}

function summaryMarkdown(loaded: Loaded, rows: ExternalRow[], label: string) {
  const { meta } = loaded.report;
  const head = [
    `# Informe ${label}${meta.code ? ` ${meta.code}` : ""}`,
    "",
    meta.person && `- Persona: ${meta.person}`,
    meta.periodStart && meta.periodEnd && `- Período: ${meta.periodStart} a ${meta.periodEnd}`,
    `- Archivo: ${loaded.fileName}`,
    `- Registros cargados: ${rows.length} (${formatDuration(sumHours(rows))})`,
    "",
    "| Fecha | Proyecto | Tipo | Horas | Descripción |",
    "| --- | --- | --- | --- | --- |",
  ].filter((l): l is string => typeof l === "string");
  const esc = (s: string) => s.replace(/\|/g, "\\|");
  return [
    ...head,
    ...rows.map((r) => `| ${r.date} | ${esc(r.externalProject)} | ${esc(r.details.type)} | ${r.hours} | ${esc(r.title)} |`),
  ].join("\n");
}

/**
 * "Cargar datos": lee el informe de otra plataforma en el navegador, muestra
 * la vista previa con el mapeo de proyectos y carga cada registro como tarea
 * hecha + horas. Los ya cargados aparecen marcados y no se repiten.
 */
export function DataImport({ projects, savedLinks, defaultFormat }: Props) {
  const [formatId, setFormatId] = useState<ImportFormatId>(findFormat(defaultFormat).id);
  const format = findFormat(formatId);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [already, setAlready] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>("");
  const [done, setDone] = useState(false);
  const { pending, run } = useAction();

  const rows = useMemo(() => loaded?.report.rows ?? [], [loaded]);
  const externalProjects = useMemo(() => {
    const by = new Map<string, ExternalRow[]>();
    for (const r of rows) by.set(r.externalProject, [...(by.get(r.externalProject) ?? []), r]);
    return [...by.entries()].map(([name, list]) => ({ name, count: list.length, hours: sumHours(list) }));
  }, [rows]);

  const selected = rows.filter((r) => !excluded.has(r.externalId) && !already.has(r.externalId));
  const unmapped = externalProjects.filter((p) => !mapping[p.name] && selected.some((r) => r.externalProject === p.name));
  const visible = filter ? rows.filter((r) => r.externalProject === filter) : rows;

  async function refreshLoaded(report: ExternalReport) {
    const dates = report.rows.map((r) => r.date).sort();
    const from = report.meta.periodStart ?? dates[0];
    const to = report.meta.periodEnd ?? dates[dates.length - 1];
    if (!from || !to) return;
    setAlready(new Set(await listLoadedExternalIds({ source: formatId, from, to })));
  }

  async function onFile(file: File) {
    setReading(true);
    setReadError(null);
    setDone(false);
    try {
      const { extractPdfText } = await import("@/lib/import/pdf-text");
      const report = format.parse(await extractPdfText(file));
      if (report.rows.length === 0) {
        setLoaded(null);
        setReadError(report.warnings[0] ?? "No se encontraron registros en el archivo.");
        return;
      }
      const links = savedLinks[formatId] ?? [];
      const names = [...new Set(report.rows.map((r) => r.externalProject))];
      setMapping(Object.fromEntries(names.map((n) => [n, suggestProject(n, links, projects)])));
      // Los no facturables no se cargan por defecto (no deben sumar en la liquidación).
      setExcluded(new Set(report.rows.filter((r) => !r.billable).map((r) => r.externalId)));
      setFilter("");
      setLoaded({ report, fileName: file.name });
      await refreshLoaded(report);
    } catch {
      setLoaded(null);
      setReadError("No se pudo leer el PDF. Verifica que sea el informe descargado de la plataforma.");
    } finally {
      setReading(false);
    }
  }

  function toggle(id: string, include: boolean) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (include) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    if (!loaded) return;
    const usedProjects = [...new Set(selected.map((r) => r.externalProject))];
    run(
      () =>
        importExternal({
          source: formatId,
          meta: {
            code: loaded.report.meta.code,
            periodStart: loaded.report.meta.periodStart,
            periodEnd: loaded.report.meta.periodEnd,
            summaryMd: summaryMarkdown(loaded, selected, format.label),
          },
          links: usedProjects.map((name) => ({ externalName: name, projectId: mapping[name] })),
          rows: selected.map((r) => ({
            externalId: r.externalId,
            date: r.date,
            externalProject: r.externalProject,
            title: r.title,
            notes: r.notes,
            tags: r.tags,
            hours: r.hours,
          })),
        }),
      () => {
        setDone(true);
        void refreshLoaded(loaded.report);
      },
    );
  }

  const meta = loaded?.report.meta;
  const totalRead = sumHours(rows);
  const matches =
    loaded &&
    loaded.report.warnings.length === 0 &&
    meta?.declaredRecords === rows.length &&
    meta?.declaredHours !== null;
  const mappedProjects = [...new Set(Object.values(mapping).filter(Boolean))];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-[16rem_1fr] sm:items-end">
        <Field>
          <FieldLabel htmlFor="data-format">Formato</FieldLabel>
          <NativeSelect
            id="data-format"
            value={formatId}
            onChange={(e) => {
              setFormatId(e.target.value as ImportFormatId);
              setLoaded(null);
            }}
            className="w-full max-sm:[&>select]:h-11"
          >
            {IMPORT_FORMATS.map((f) => (
              <NativeSelectOption key={f.id} value={f.id}>
                {f.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <div className="flex flex-col gap-1.5">
          <div>
            <Button
              variant="outline"
              className="max-sm:h-11"
              disabled={reading}
              nativeButton={false}
              render={<label htmlFor="data-file" />}
            >
              {reading ? <Spinner data-icon="inline-start" /> : <FileUpIcon data-icon="inline-start" />}
              {reading ? "Leyendo…" : loaded ? "Subir otro PDF" : "Subir PDF"}
            </Button>
            <input
              id="data-file"
              type="file"
              accept={format.accept}
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
                e.target.value = "";
              }}
            />
          </div>
          <FieldDescription>{format.description} El archivo se lee en tu navegador.</FieldDescription>
        </div>
      </div>

      {readError && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>No se pudo cargar el informe</AlertTitle>
          <AlertDescription>{readError}</AlertDescription>
        </Alert>
      )}

      {loaded && meta && (
        <>
          <section aria-labelledby="data-summary" className="flex flex-col gap-3 rounded-lg border p-4">
            <h2 id="data-summary" className="text-sm font-semibold">
              {meta.code ?? loaded.fileName}
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Persona</dt>
                <dd className="truncate">{meta.person ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Período</dt>
                <dd>
                  {meta.periodStart && meta.periodEnd
                    ? `${formatShortDate(meta.periodStart)} – ${formatShortDate(meta.periodEnd)}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Registros</dt>
                <dd className="tabular-nums">{rows.length}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Horas</dt>
                <dd className="tabular-nums">{formatDuration(totalRead)}</dd>
              </div>
            </dl>
            {matches ? (
              <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                <CheckCircle2Icon className="size-3.5" aria-hidden />
                Cuadra con el informe: {meta.declaredRecords} registros y {formatDuration(meta.declaredHours)}.
              </p>
            ) : (
              loaded.report.warnings.map((w) => (
                <p key={w} className="flex items-start gap-1.5 text-xs text-destructive">
                  <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {w}
                </p>
              ))
            )}
          </section>

          <section aria-labelledby="data-mapping" className="flex flex-col gap-3">
            <div>
              <h2 id="data-mapping" className="text-sm font-semibold">
                Proyectos
              </h2>
              <p className="text-sm text-muted-foreground">
                Elige a qué proyecto de Chronos van las horas de cada proyecto de {format.label}. Se recuerda
                para la próxima carga.
              </p>
            </div>
            <ul className="flex flex-col gap-2">
              {externalProjects.map((p) => (
                <li key={p.name} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_18rem] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {p.count} registros · {formatDuration(p.hours)}
                    </p>
                  </div>
                  <NativeSelect
                    aria-label={`Proyecto de Chronos para ${p.name}`}
                    aria-invalid={!mapping[p.name] && unmapped.some((u) => u.name === p.name) ? true : undefined}
                    value={mapping[p.name] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [p.name]: e.target.value }))}
                    className="w-full max-sm:[&>select]:h-11"
                  >
                    <NativeSelectOption value="">Elige un proyecto…</NativeSelectOption>
                    {projects.map((o) => (
                      <NativeSelectOption key={o.id} value={o.id}>
                        {o.code_prefix} · {o.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="data-rows" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="data-rows" className="text-sm font-semibold">
                Registros
              </h2>
              {externalProjects.length > 1 && (
                <NativeSelect
                  aria-label="Filtrar por proyecto"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="max-sm:w-full max-sm:[&>select]:h-11"
                >
                  <NativeSelectOption value="">Todos los proyectos</NativeSelectOption>
                  {externalProjects.map((p) => (
                    <NativeSelectOption key={p.name} value={p.name}>
                      {p.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </div>

            {/* Escritorio: tabla. */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-0">
                      <span className="sr-only">Incluir</span>
                    </TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead>Descripción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((r) => {
                    const isLoaded = already.has(r.externalId);
                    return (
                      <TableRow key={r.externalId} className={cn(isLoaded && "opacity-60")}>
                        <TableCell>
                          <Checkbox
                            checked={isLoaded || !excluded.has(r.externalId)}
                            disabled={isLoaded}
                            onCheckedChange={(c) => toggle(r.externalId, c)}
                            aria-label={`Incluir “${r.title}”`}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatShortDate(r.date)}</TableCell>
                        <TableCell className="max-w-40 truncate" title={r.externalProject}>
                          {r.externalProject}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{r.details.type}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatDuration(r.hours)}</TableCell>
                        <TableCell className="min-w-64 whitespace-normal">
                          {r.title}
                          <RowBadges row={r} loaded={isLoaded} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Celular: tarjetas. */}
            <ul className="flex flex-col gap-2 md:hidden">
              {visible.map((r) => {
                const isLoaded = already.has(r.externalId);
                return (
                  <li key={r.externalId} className={cn("flex gap-3 rounded-lg border p-3", isLoaded && "opacity-60")}>
                    <Checkbox
                      className="mt-0.5"
                      checked={isLoaded || !excluded.has(r.externalId)}
                      disabled={isLoaded}
                      onCheckedChange={(c) => toggle(r.externalId, c)}
                      aria-label={`Incluir “${r.title}”`}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="text-sm">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatShortDate(r.date)} · {formatDuration(r.hours)} · {r.details.type}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{r.externalProject}</p>
                      <RowBadges row={r} loaded={isLoaded} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="sticky bottom-2 flex flex-col gap-2 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {unmapped.length > 0
                ? `Falta elegir el proyecto de: ${unmapped.map((p) => p.name).join(", ")}.`
                : already.size > 0
                  ? `${already.size} ya ${already.size === 1 ? "estaba cargado" : "estaban cargados"}.`
                  : "Cada registro queda como tarea hecha en su fecha, con sus horas en el proyecto."}
            </p>
            <Button className="max-sm:h-11" disabled={pending || selected.length === 0 || unmapped.length > 0} onClick={submit}>
              {pending && <Spinner data-icon="inline-start" />}
              Cargar {selected.length} {selected.length === 1 ? "actividad" : "actividades"} (
              {formatDuration(sumHours(selected))})
            </Button>
          </div>

          {done && (
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <Link href="/tasks?view=done" className="underline underline-offset-4">
                Ver tareas hechas
              </Link>
              {mappedProjects.map((id) => (
                <Link key={id} href={`/projects/${id}`} className="underline underline-offset-4">
                  Ver horas de {projects.find((p) => p.id === id)?.name ?? "proyecto"}
                </Link>
              ))}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function RowBadges({ row, loaded }: { row: ExternalRow; loaded: boolean }) {
  // Etiquetas extra (p. ej. #iniciativa-orion): ni la del formato ni la del tipo, que ya se ven.
  const extra = row.tags.slice(1).filter((t) => t !== slugTag(row.details.type));
  if (!loaded && row.billable && extra.length === 0) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {loaded && <Badge variant="secondary">Ya cargado</Badge>}
      {!row.billable && <Badge variant="outline">No facturable</Badge>}
      {extra.map((t) => (
        <Badge key={t} variant="outline">
          #{t}
        </Badge>
      ))}
    </span>
  );
}
