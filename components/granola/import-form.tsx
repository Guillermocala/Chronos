"use client";

import { FileUpIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { importDictation } from "@/app/(app)/import/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action-toast";
import type { ISODate } from "@/lib/dates";
import { parseDictation } from "@/lib/granola/parse";

import { DictationReview, toImportItems, useReviewRows, type ProjectOption } from "./dictation-review";

type Props = { projects: ProjectOption[]; today: ISODate };

// Constante para no crear un arreglo nuevo en cada render (reiniciaría las ediciones).
const NO_ITEMS: never[] = [];

export function ImportForm({ projects, today }: Props) {
  const [markdown, setMarkdown] = useState("");
  const { pending, run } = useAction();

  const parsed = useMemo(
    () => (markdown.trim() ? parseDictation(markdown, { projects, today }) : null),
    [markdown, projects, today],
  );
  const { rows, selected, update } = useReviewRows(parsed?.items ?? NO_ITEMS);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="markdown">Nota de Granola (Markdown)</FieldLabel>
          <Textarea
            id="markdown"
            rows={10}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
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
              if (file) setMarkdown(await file.text());
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
            <DictationReview rows={rows} projects={projects} onUpdate={update} />
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
                      items: toImportItems(selected),
                    }),
                  () => setMarkdown(""),
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
