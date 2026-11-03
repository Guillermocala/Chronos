import type { ISODate } from "@/lib/dates";
import type { TaskWithProject } from "@/lib/data/tasks";
import type { Reward } from "@/lib/quests/reward";

import type { ProjectChoice } from "./task-dialog";
import { TaskItem } from "./task-item";

type Props = {
  tasks: TaskWithProject[];
  today: ISODate;
  projects: ProjectChoice[];
  /** Valor de cada tarea por id (Misiones); sin él no se muestra el chip. */
  rewards?: Record<string, Reward>;
};

export function TaskList({ tasks, today, projects, rewards }: Props) {
  return (
    <ul className="flex flex-col">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} today={today} projects={projects} reward={rewards?.[task.id]} />
      ))}
    </ul>
  );
}
