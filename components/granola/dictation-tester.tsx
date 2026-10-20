"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { ISODate } from "@/lib/dates";
import { parseDictation, type ProjectRef } from "@/lib/granola/parse";

import { ParsedItemBadges } from "./parsed-item-badges";

type Props = { projects: ProjectRef[]; today: ISODate; initial: string };

/** Probador en vivo: muestra cómo interpretaría Chronos un dictado. */
export function DictationTester({ projects, today, initial }: Props) {
  const [text, setText] = useState(initial);
  const result = useMemo(() => parseDictation(text, { projects, today }), [text, projects, today]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="tester">Texto de prueba</FieldLabel>
        <Textarea
          id="tester"
          rows={14}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="font-mono text-xs"
        />
        <FieldDescription>Pega aquí una nota de Granola o escribe líneas con marcadores.</FieldDescription>
      </Field>
      <div className="flex flex-col gap-3" aria-live="polite">
        <p className="text-sm text-muted-foreground">
          {result.isMyDay ? "Dictado de Mi día" : "Nota"} del {result.date} · {result.items.length} ítems
          {result.skippedDone > 0 && ` · ${result.skippedDone} ya hechos (se omiten)`}
        </p>
        <ul className="flex flex-col gap-3">
          {result.items.map((item, i) => (
            <li key={i} className="flex flex-col gap-1.5 rounded-lg border p-3">
              <span className="text-sm font-medium">{item.title || "(sin título)"}</span>
              <ParsedItemBadges item={item} />
              {item.warnings.map((w) => (
                <span key={w} className="flex items-center gap-1 text-xs text-destructive">
                  <TriangleAlertIcon className="size-3" aria-hidden />
                  {w}
                </span>
              ))}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
