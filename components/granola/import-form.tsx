"use client";

import { FileUpIcon, TriangleAlertIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { importDictation } from "@/app/(app)/import/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action-toast";
import type { ISODate } from "@/lib/dates";
import { parseDictation, type ParsedItem } from "@/lib/granola/parse";

import { ITEM_TYPE_LABELS, ParsedItemBadges } from "./parsed-item-badges";

type ProjectOption = { id: string; name: string; code_prefix: string };

type Props = { projects: ProjectOption[]; today: ISODate };

type Row = ParsedItem & { include: boolean };

export function ImportForm({ projects, today }: Props) {
  const [markdown, setMarkdown] = useState("");
  const [edits, setEdits] = useState<Record<number, Partial<Row>>>({});
  const { pending, run } = useAction();

  const parsed = useMemo(
    () => (markdown.trim() ? parseDictation(markdown, { projects, today }) : null),
    [markdown, projects, today],
  );
  const rows: Row[] = (parsed?.items ?? []).map((item, i) => ({ ...item, include: true, ...edits[i] }));
  const selected = rows.filter((r) => r.include && r.title.trim());

  const update = (index: number, change: Partial<Row>) =>
    setEdits((prev) => ({ ...prev, [index]: { ...prev[index], ...change } }));

  const loadText = (text: string) => {
    setMarkdown(text);
    setEdits({});
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="markdown">Nota de Granola (Markdown)</FieldLabel>
          <Textarea
            id="markdown"
            rows={10}
            value={markdown}
            onChange={(e) => loadText(e.target.value)}
            placeholder={"# Mi día — " + today + "\n## Tareas\n- [ ] Llamar al contador !hoy"}
            className="font-mono text-xs"
          />
          <FieldDescription>Pega la nota copiada desde Granola o sube el archivo .md exportado.</FieldDescription>
        </Field>
        <div>
          <Button variant="outline" size="sm" nativeButton={false} render={<label htmlFor="md-file" />}>
            <FileUpIcon data-icon="inline-start" />
            Subir archivo .md
          </Button>
          <input
            id="md-file"
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) loadText(await file.text());
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {parsed && (
        <section className="flex flex-col gap-3" aria-labelledby="preview-title">
          <h2 id="preview-title" className="text-sm font-semibold">
            Vista previa · {parsed.title ?? "Sin título"} · {parsed.date}
            {parsed.isMyDay && " · Mi día"}
          </h2>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se encontraron ítems. Revisa que las líneas estén bajo ## Tareas, ## Seguimientos o
              ## Tickets, o que sean casillas “- [ ]”.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {rows.map((row, i) => (
                <li key={i} className="flex gap-3 rounded-lg border p-3">
                  <Checkbox
                    className="mt-2"
                    checked={row.include}
                    onCheckedChange={(checked) => update(i, { include: checked })}
                    aria-label={`Incluir “${row.title}”`}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="grid gap-2 sm:grid-cols-[1fr_9rem_12rem]">
                      <Input
                        aria-label="Título"
                        value={row.title}
                        onChange={(e) => update(i, { title: e.target.value })}
                      />
                      <NativeSelect
                        aria-label="Tipo"
                        value={row.type}
                        onChange={(e) => update(i, { type: e.target.value as Row["type"] })}
                      >
                        {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => (
                          <NativeSelectOption key={value} value={value}>
                            {label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <NativeSelect
                        aria-label="Proyecto"
                        value={row.projectId ?? ""}
                        onChange={(e) => {
                          const project = projects.find((p) => p.id === e.target.value);
                          update(i, {
                            projectId: project?.id ?? null,
                            projectPrefix: project?.code_prefix ?? null,
                            warnings: row.warnings.filter((w) => !w.startsWith("El proyecto")),
                          });
                        }}
                      >
                        <NativeSelectOption value="">Personal (sin proyecto)</NativeSelectOption>
                        {projects.map((p) => (
                          <NativeSelectOption key={p.id} value={p.id}>
                            {p.code_prefix} · {p.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>
                    <ParsedItemBadges item={row} />
                    {row.warnings.map((w) => (
                      <span key={w} className="flex items-center gap-1 text-xs text-destructive">
                        <TriangleAlertIcon className="size-3" aria-hidden />
                        {w}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div>
            <Button
              disabled={pending || selected.length === 0}
              onClick={() =>
                run(
                  () =>
                    importDictation({
                      title: parsed.title,
                      date: parsed.date,
                      markdown,
                      items: selected.map((r) => ({
                        type: r.type,
                        title: r.title,
                        projectId: r.projectId,
                        due_date: r.due_date,
                        planned_on: r.planned_on,
                        priority: r.priority,
                        tags: r.tags,
                        waiting_on: r.waiting_on,
                        doc_url: r.doc_url,
                        estimated_hours: r.estimated_hours,
                      })),
                    }),
                  () => loadText(""),
                )
              }
            >
              {pending && <Spinner data-icon="inline-start" />}
              Crear {selected.length} {selected.length === 1 ? "ítem" : "ítems"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
