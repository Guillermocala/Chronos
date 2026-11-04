"use client";

import { XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { TASK_VIEWS, type TaskView } from "@/lib/data/task-views";
import { TASK_WHEN, type TaskWhen } from "@/lib/tasks/today";

import type { ProjectChoice } from "./task-dialog";

type Props = {
  view: TaskView;
  project?: string;
  tag?: string;
  projects: ProjectChoice[];
  /** Filtro por fecha; sin `whenCounts` no se muestra (vistas sin fechas). */
  when?: TaskWhen;
  whenCounts?: Record<Exclude<TaskWhen, "">, number>;
};

export function TaskFilters({ view, project, tag, projects, when = "", whenCounts }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefWith = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  return (
    <div className="flex flex-col gap-3">
      <nav className="flex flex-wrap gap-1" aria-label="Vistas de tareas">
        {TASK_VIEWS.map((v) => (
          <Button
            key={v.key}
            size="sm"
            variant={v.key === view ? "secondary" : "ghost"}
            nativeButton={false}
            render={<Link href={hrefWith({ view: v.key })} aria-current={v.key === view ? "page" : undefined} />}
          >
            {v.label}
          </Button>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          size="sm"
          aria-label="Filtrar por proyecto"
          value={project ?? ""}
          onChange={(e) => router.push(hrefWith({ project: e.target.value || undefined }))}
        >
          <NativeSelectOption value="">Todos los proyectos</NativeSelectOption>
          <NativeSelectOption value="personal">Personal (sin proyecto)</NativeSelectOption>
          {projects.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.code_prefix} · {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {whenCounts && (
          <NativeSelect
            size="sm"
            aria-label="Filtrar por fecha"
            value={when}
            onChange={(e) => router.push(hrefWith({ when: e.target.value || undefined }))}
          >
            <NativeSelectOption value="">Todas las fechas</NativeSelectOption>
            {TASK_WHEN.map((w) => (
              <NativeSelectOption key={w.key} value={w.key}>
                {w.label} ({whenCounts[w.key]})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        {tag && (
          <Badge variant="secondary" render={<Link href={hrefWith({ tag: undefined })} />}>
            #{tag}
            <XIcon data-icon="inline-end" />
          </Badge>
        )}
      </div>
    </div>
  );
}
