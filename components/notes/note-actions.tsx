"use client";

import { ArchiveIcon } from "lucide-react";

import { archiveNote } from "@/app/(app)/notes/actions";
import { CopyButton } from "@/components/granola/copy-button";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action-toast";

export function NoteActions({ id, markdown }: { id: string; markdown: string }) {
  const { pending, run } = useAction();
  return (
    <>
      <CopyButton text={markdown} label="Copiar Markdown" />
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => archiveNote(id))}>
        <ArchiveIcon data-icon="inline-start" />
        Archivar
      </Button>
    </>
  );
}
