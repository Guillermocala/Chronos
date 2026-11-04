"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { useState } from "react";

import { reorderMyDay } from "@/app/(app)/tasks/actions";
import { showResult } from "@/hooks/use-action-toast";
import type { ISODate } from "@/lib/dates";
import type { TaskWithProject } from "@/lib/data/tasks";
import type { Reward } from "@/lib/quests/reward";

import type { ProjectChoice } from "./task-dialog";
import { TaskItem } from "./task-item";

type Props = {
  tasks: TaskWithProject[];
  today: ISODate;
  projects: ProjectChoice[];
  rewards?: Record<string, Reward>;
};

/**
 * Lista de Mi día con orden manual: se arrastra desde el asa ⠿ (mouse, dedo o
 * teclado) o con Subir / Bajar / Mover al inicio en el menú de cada tarea.
 */
export function SortableTaskList({ tasks, today, projects, rewards }: Props) {
  const [order, setOrder] = useState(tasks);
  // Si el servidor trae datos nuevos (revalidación), se sincroniza el estado local.
  const [source, setSource] = useState(tasks);
  if (source !== tasks) {
    setSource(tasks);
    setOrder(tasks);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const titleOf = (id: string | number) => order.find((t) => t.id === id)?.title ?? "tarea";
  const placeOf = (id: string | number | undefined) => {
    const index = order.findIndex((t) => t.id === id);
    return index === -1 ? "fuera de la lista" : `posición ${index + 1} de ${order.length}`;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Tomaste “${titleOf(active.id)}”.`,
    onDragOver: ({ active, over }) => `“${titleOf(active.id)}” en ${placeOf(over?.id)}.`,
    onDragEnd: ({ active, over }) => `“${titleOf(active.id)}” quedó en ${placeOf(over?.id)}.`,
    onDragCancel: ({ active }) => `Se canceló el movimiento de “${titleOf(active.id)}”.`,
  };

  async function save(next: TaskWithProject[]) {
    const previous = order;
    setOrder(next);
    const result = await reorderMyDay(next.map((t) => t.id));
    if (!result.ok) {
      showResult(result);
      setOrder(previous);
    }
  }

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= order.length) return;
    void save(arrayMove(order, from, to));
  };

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    move(
      order.findIndex((t) => t.id === active.id),
      order.findIndex((t) => t.id === over.id),
    );
  }

  return (
    <DndContext
      id="my-day"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Para reordenar con el teclado, presiona espacio para tomar la tarea, usa las flechas arriba y abajo para moverla y espacio para soltarla. Escape cancela.",
        },
      }}
    >
      <SortableContext items={order.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col">
          {order.map((task, index) => (
            <SortableTask
              key={task.id}
              task={task}
              today={today}
              projects={projects}
              reward={rewards?.[task.id]}
              onTop={index > 0 ? () => move(index, 0) : undefined}
              onUp={index > 0 ? () => move(index, index - 1) : undefined}
              onDown={index < order.length - 1 ? () => move(index, index + 1) : undefined}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableTask({
  task,
  today,
  projects,
  reward,
  onTop,
  onUp,
  onDown,
}: {
  task: TaskWithProject;
  today: ISODate;
  projects: ProjectChoice[];
  reward?: Reward;
  onTop?: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  return (
    <TaskItem
      task={task}
      today={today}
      projects={projects}
      reward={reward}
      sortable={{
        setNodeRef,
        style: { transform: CSS.Transform.toString(transform), transition },
        dragging: isDragging,
        onTop,
        onUp,
        onDown,
        handle: (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-roledescription="tarea ordenable"
            aria-label={`Reordenar “${task.title}”`}
            className="-my-2 flex h-11 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing sm:h-8 sm:w-6"
          >
            <GripVerticalIcon className="size-4" aria-hidden />
          </button>
        ),
      }}
    />
  );
}
