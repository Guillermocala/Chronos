"use client";

import { ArchiveIcon } from "lucide-react";

import { useRouter } from "next/navigation";

import { archiveNote } from "@/app/(app)/notes/actions";
import { restoreDeleted } from "@/app/(app)/undo-actions";
import { CopyButton } from "@/components/granola/copy-button";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action-toast";

export function NoteActions({
  id,
  markdown,
}: {
  id: string;
  markdown: string;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  return (
    <>
      <CopyButton text={markdown} label="Copiar Markdown" />
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          run(
            () => archiveNote(id),
            () => router.push("/notes"),
            () => restoreDeleted("meeting_notes", id),
          )
        }
      >
        <ArchiveIcon data-icon="inline-start" />
        Archivar
      </Button>
    </>
  );
}
