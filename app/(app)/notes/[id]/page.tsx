import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Markdown } from "@/components/markdown";
import { NoteActions } from "@/components/notes/note-actions";
import { PageHeader } from "@/components/page-header";
import { ProjectBadge } from "@/components/tasks/project-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getNote } from "@/lib/data/notes";
import { formatDate } from "@/lib/format";
import { TICKET_STATUS_LABELS } from "@/lib/tickets/schema";

export const metadata: Metadata = { title: "Nota · Chronos" };

const TASK_STATUS = { open: "Abierta", waiting: "Esperando", done: "Hecha", dismissed: "Descartada" } as const;

export default function NotePage({ params }: PageProps<"/notes/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <NoteContent params={params} />
    </Suspense>
  );
}

async function NoteContent({ params }: Pick<PageProps<"/notes/[id]">, "params">) {
  const { id } = await params;
  const note = await getNote(id);
  if (!note) notFound();
  const itemCount = note.tasks.length + note.tickets.length;

  return (
    <>
      <PageHeader
        title={note.title}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            {formatDate(note.meeting_date)}
            {note.project && <ProjectBadge {...note.project} />}
            <Badge variant="outline">{note.source === "granola" ? "Granola" : "Manual"}</Badge>
          </span>
        }
        actions={<NoteActions id={note.id} markdown={note.content_md} />}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardContent>
            <Markdown>{note.content_md}</Markdown>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ítems creados</CardTitle>
            <CardDescription>{itemCount === 0 ? "Ninguno." : `${itemCount} a partir de esta nota.`}</CardDescription>
          </CardHeader>
          {itemCount > 0 && (
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm">
                {note.tickets.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-2">
                    <Link href={`/tickets/${t.id}`} className="min-w-0 hover:underline">
                      <span className="font-mono text-xs text-muted-foreground">{t.code}</span> {t.title}
                    </Link>
                    <Badge variant="outline">{TICKET_STATUS_LABELS[t.status]}</Badge>
                  </li>
                ))}
                {note.tasks.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-2">
                    <Link href="/tasks" className="min-w-0 hover:underline">
                      {t.title}
                    </Link>
                    <Badge variant={t.status === "done" ? "secondary" : "outline"}>
                      {t.is_ticket_candidate ? "Candidato a ticket" : t.kind === "follow_up" ? "Seguimiento" : TASK_STATUS[t.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      </div>
    </>
  );
}
