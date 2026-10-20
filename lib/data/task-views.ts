// Vistas de /tasks. Separado de lib/data/tasks.ts (server-only) para usarlo en el cliente.

export type TaskView = "upcoming" | "waiting" | "inbox" | "done";

export const TASK_VIEWS: { key: TaskView; label: string }[] = [
  { key: "upcoming", label: "Próximos 7 días" },
  { key: "waiting", label: "Esperando" },
  { key: "inbox", label: "Bandeja" },
  { key: "done", label: "Completadas" },
];
