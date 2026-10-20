import { NotebookTextIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { NoteFilters } from "@/components/notes/note-filters";
import { PageHeader } from "@/components/page-header";
import { ProjectBadge } from "@/components/tasks/project-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { listNotes } from "@/lib/data/notes";
import { listProjectOptions } from "@/lib/data/projects";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Notas · Chronos" };

export default function NotesPage({ searchParams }: PageProps<"/notes">) {
  return (
    <>
      <PageHeader
        title="Notas"
        description="Dictados y reuniones importados desde Granola, con lo que se creó a partir de ellos."
        actions={
          <Button size="sm" nativeButton={false} render={<Link href="/import" />}>
            Importar dictado
          </Button>
        }
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <NotesContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function NotesContent({ searchParams }: Pick<PageProps<"/notes">, "searchParams">) {
  await requireUser();
  const params = await searchParams;
  const project = param(params.project) || undefined;
  const q = param(params.q)?.trim() || undefined;
  const [notes, projects] = await Promise.all([
    listNotes({ projectId: project, q }),
    listProjectOptions({ includeClosed: true }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <NoteFilters project={project} q={q} projects={projects} />
      {notes.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <NotebookTextIcon />
            </EmptyMedia>
            <EmptyTitle>{q || project ? "Sin resultados" : "Aún no hay notas"}</EmptyTitle>
            <EmptyDescription>
              {q || project
                ? "Prueba con otra búsqueda o proyecto."
                : "Importa un dictado de Granola para verlo aquí."}
            </EmptyDescription>
          </EmptyHeader>
          {!q && !project && (
            <EmptyContent>
              <Button size="sm" nativeButton={false} render={<Link href="/import" />}>
                Importar dictado
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {notes.map((note) => (
            <li key={note.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
              <Link href={`/notes/${note.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                {note.title}
              </Link>
              {note.project && <ProjectBadge {...note.project} />}
              <Badge variant="outline">{note.items} ítems</Badge>
              <span className="text-sm text-muted-foreground tabular-nums">{formatDate(note.meeting_date)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
