"use client";

import {
  ArchiveIcon,
  EllipsisIcon,
  FolderIcon,
  LockIcon,
  PencilIcon,
  RotateCcwIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { archiveProject, closeProject, reopenProject } from "@/app/(app)/projects/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAction } from "@/hooks/use-action-toast";
import type { ISODate } from "@/lib/dates";
import type { Project } from "@/lib/data/projects";

import { DeliverDialog } from "./deliver-dialog";

type Props = {
  project: Project;
  today: ISODate;
  remainingCOP: number | null;
};

export function ProjectActions({ project, today, remainingCOP }: Props) {
  const { pending, run } = useAction();
  const [confirmArchive, setConfirmArchive] = useState(false);

  return (
    <>
      {project.drive_folder_url && (
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={project.drive_folder_url} target="_blank" rel="noopener noreferrer" />}
        >
          <FolderIcon data-icon="inline-start" />
          Drive
        </Button>
      )}
      {project.phase === "active" && (
        <DeliverDialog
          projectId={project.id}
          supportDays={project.support_days}
          today={today}
          remainingCOP={remainingCOP}
        />
      )}
      {(project.phase === "support" || project.phase === "delivered") && (
        <Button size="sm" disabled={pending} onClick={() => run(() => closeProject(project.id))}>
          <LockIcon data-icon="inline-start" />
          Cerrar proyecto
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label="Más acciones" />}>
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem render={<Link href={`/projects/${project.id}/edit`} />}>
              <PencilIcon />
              Editar
            </DropdownMenuItem>
            {project.phase !== "active" && (
              <DropdownMenuItem onClick={() => run(() => reopenProject(project.id))}>
                <RotateCcwIcon />
                Reabrir (volver a activo)
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmArchive(true)}>
              <ArchiveIcon />
              Archivar
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar {project.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Desaparece de las listas y sus seguimientos automáticos se descartan. Los datos se
              conservan en la base de datos y en los backups.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => run(() => archiveProject(project.id))}>
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
