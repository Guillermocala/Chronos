import type { ISODate } from "@/lib/dates";
import type { TaskWithProject } from "@/lib/data/tasks";

import type { ProjectChoice } from "./task-dialog";
import { TaskItem } from "./task-item";

type Props = {
  tasks: TaskWithProject[];
  today: ISODate;
  projects: ProjectChoice[];
};

export function TaskList({ tasks, today, projects }: Props) {
  return (
    <ul className="flex flex-col">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} today={today} projects={projects} />
      ))}
    </ul>
  );
}
