"use client";

import { PlusIcon } from "lucide-react";

import { quickCreateTicket } from "@/app/(app)/tickets/actions";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { useAction } from "@/hooks/use-action-toast";

/** Creación rápida: "Maquetar contacto ~3h #alta !viernes". */
export function QuickTicketForm({ projectId, sprintId }: { projectId: string; sprintId?: string | null }) {
  const { pending, submit } = useAction();

  return (
    <form
      onSubmit={submit(quickCreateTicket, (f) => f.reset())}
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="sprint_id" value={sprintId ?? ""} />
      <InputGroup>
        <InputGroupInput
          name="text"
          required
          autoComplete="off"
          aria-label="Nuevo ticket"
          placeholder="Nuevo ticket… ej. Maquetar contacto ~3h #alta"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton type="submit" size="icon-xs" disabled={pending} aria-label="Crear ticket">
            <PlusIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
