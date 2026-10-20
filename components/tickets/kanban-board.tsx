"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";

import { moveTicket } from "@/app/(app)/tickets/actions";
import { showResult } from "@/hooks/use-action-toast";
import type { TicketWithHours } from "@/lib/data/tickets";
import { formatCOP } from "@/lib/format";
import { TICKET_STATUS_LABELS, TICKET_STATUSES, type TicketStatus } from "@/lib/tickets/schema";
import { formatDuration } from "@/lib/time";

import { TicketCard } from "./ticket-card";

type Columns = Record<TicketStatus, TicketWithHours[]>;

type Props = {
  tickets: TicketWithHours[];
  /** Valor estimado por ticket (id → COP). */
  values: Record<string, number | null>;
  runningTicketId: string | null;
};

function toColumns(tickets: TicketWithHours[]): Columns {
  const columns = Object.fromEntries(TICKET_STATUSES.map((s) => [s, [] as TicketWithHours[]])) as Columns;
  for (const t of [...tickets].sort((a, b) => a.position - b.position)) columns[t.status].push(t);
  return columns;
}

function columnOf(columns: Columns, id: string): TicketStatus | null {
  if ((TICKET_STATUSES as readonly string[]).includes(id)) return id as TicketStatus;
  return TICKET_STATUSES.find((s) => columns[s].some((t) => t.id === id)) ?? null;
}

export function KanbanBoard({ tickets, values, runningTicketId }: Props) {
  const [columns, setColumns] = useState(() => toColumns(tickets));
  const [activeId, setActiveId] = useState<string | null>(null);
  // Si el servidor trae datos nuevos (revalidación), se sincroniza el estado local.
  const [source, setSource] = useState(tickets);
  if (source !== tickets) {
    setSource(tickets);
    setColumns(toColumns(tickets));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const find = (id: string) => TICKET_STATUSES.flatMap((s) => columns[s]).find((t) => t.id === id);
  const label = (id: string | number) => find(String(id))?.code ?? "ticket";
  const columnLabel = (id: string | number | undefined) => {
    const col = id === undefined ? null : columnOf(columns, String(id));
    return col ? TICKET_STATUS_LABELS[col] : "fuera del tablero";
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Tomaste ${label(active.id)}.`,
    onDragOver: ({ active, over }) => `${label(active.id)} sobre ${columnLabel(over?.id)}.`,
    onDragEnd: ({ active, over }) => `${label(active.id)} soltado en ${columnLabel(over?.id)}.`,
    onDragCancel: ({ active }) => `Se canceló el movimiento de ${label(active.id)}.`,
  };

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
  }

  // Al pasar a otra columna, la tarjeta se mueve en el estado local (vista previa).
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = columnOf(columns, String(active.id));
    const to = columnOf(columns, String(over.id));
    if (!from || !to || from === to) return;
    setColumns((prev) => {
      const moving = prev[from].find((t) => t.id === active.id)!;
      const overIndex = prev[to].findIndex((t) => t.id === over.id);
      const index = overIndex === -1 ? prev[to].length : overIndex;
      return {
        ...prev,
        [from]: prev[from].filter((t) => t.id !== active.id),
        [to]: [...prev[to].slice(0, index), { ...moving, status: to }, ...prev[to].slice(index)],
      };
    });
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const column = columnOf(columns, String(active.id));
    if (!column) return;

    const list = columns[column];
    const from = list.findIndex((t) => t.id === active.id);
    const overIndex = list.findIndex((t) => t.id === over.id);
    const to = overIndex === -1 ? from : overIndex;
    const reordered = [...list];
    reordered.splice(to, 0, ...reordered.splice(from, 1));
    setColumns((prev) => ({ ...prev, [column]: reordered }));

    const original = tickets.find((t) => t.id === active.id);
    const index = reordered.findIndex((t) => t.id === active.id);
    if (original?.status === column && index === from && from === overIndex) return;

    const result = await moveTicket({
      id: String(active.id),
      status: column,
      beforeId: reordered[index - 1]?.id ?? null,
      afterId: reordered[index + 1]?.id ?? null,
    });
    if (!result.ok) {
      showResult(result);
      setColumns(toColumns(tickets));
    }
  }

  const active = activeId ? find(activeId) : null;

  return (
    <DndContext
      id="kanban"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setColumns(toColumns(tickets));
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Para mover un ticket con el teclado, presiona espacio para tomarlo, usa las flechas para moverlo entre columnas y espacio para soltarlo. Escape cancela.",
        },
      }}
    >
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {TICKET_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            tickets={columns[status]}
            values={values}
            runningTicketId={runningTicketId}
          />
        ))}
      </div>
      <DragOverlay>
        {active && (
          <TicketCard ticket={active} value={values[active.id] ?? null} running={active.id === runningTicketId} />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  tickets,
  values,
  runningTicketId,
}: {
  status: TicketStatus;
  tickets: TicketWithHours[];
  values: Record<string, number | null>;
  runningTicketId: string | null;
}) {
  const { setNodeRef } = useDroppable({ id: status });
  const estimated = tickets.reduce((sum, t) => sum + Number(t.estimated_hours ?? 0), 0);
  const value = tickets.reduce((sum, t) => sum + (values[t.id] ?? 0), 0);

  return (
    <section
      aria-labelledby={`column-${status}`}
      className="flex w-72 shrink-0 snap-start flex-col gap-2 rounded-xl bg-muted/50 p-2"
    >
      <header className="flex items-baseline justify-between gap-2 px-1">
        <h2 id={`column-${status}`} className="text-sm font-semibold">
          {TICKET_STATUS_LABELS[status]} <span className="text-muted-foreground">{tickets.length}</span>
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatDuration(estimated)}
          {value > 0 && ` · ${formatCOP(value)}`}
        </span>
      </header>
      <SortableContext id={status} items={tickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-24 flex-col gap-2">
          {tickets.map((ticket) => (
            <SortableTicket
              key={ticket.id}
              ticket={ticket}
              value={values[ticket.id] ?? null}
              running={ticket.id === runningTicketId}
            />
          ))}
        </ul>
      </SortableContext>
    </section>
  );
}

function SortableTicket({
  ticket,
  value,
  running,
}: {
  ticket: TicketWithHours;
  value: number | null;
  running: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="touch-manipulation"
      {...attributes}
      {...listeners}
      aria-roledescription="ticket arrastrable"
    >
      <TicketCard ticket={ticket} value={value} running={running} dragging={isDragging} />
    </li>
  );
}
