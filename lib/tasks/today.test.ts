import { describe, expect, it } from "vitest";

import { groupTodayTasks, type TodayTask } from "./today";

const today = "2026-10-20";
let n = 0;
const task = (over: Partial<TodayTask>): TodayTask => ({
  id: `t${++n}`,
  kind: "todo",
  status: "open",
  due_date: null,
  planned_on: null,
  auto_source: null,
  priority: 2,
  ...over,
});

const ids = (list: TodayTask[]) => list.map((t) => t.id);

describe("groupTodayTasks", () => {
  it("clasifica cada tarea en un solo grupo", () => {
    const overdue = task({ due_date: "2026-10-18" });
    const myDay = task({ planned_on: today });
    const carriedOver = task({ planned_on: "2026-10-19" });
    const dueToday = task({ due_date: today });
    const followUp = task({ kind: "follow_up", due_date: "2026-10-19", status: "waiting" });
    const payment = task({ kind: "follow_up", auto_source: "payment", due_date: today });
    const support = task({ kind: "follow_up", auto_source: "delivery", due_date: "2026-10-23" });
    const future = task({ due_date: "2026-10-25" });
    const done = task({ due_date: "2026-10-18", status: "done" });
    const futurePayment = task({ kind: "follow_up", auto_source: "payment", due_date: "2026-11-05" });
    const farSupport = task({ kind: "follow_up", auto_source: "delivery", due_date: "2026-10-30" });

    const groups = groupTodayTasks(
      [overdue, myDay, carriedOver, dueToday, followUp, payment, support, future, done, futurePayment, farSupport],
      today,
    );

    expect(ids(groups.overdue)).toEqual([overdue.id]);
    expect(ids(groups.myDay).sort()).toEqual([myDay.id, carriedOver.id].sort());
    expect(ids(groups.dueToday)).toEqual([dueToday.id]);
    expect(ids(groups.followUps)).toEqual([followUp.id]);
    expect(ids(groups.payments)).toEqual([payment.id]);
    expect(ids(groups.support)).toEqual([support.id]);
  });

  it("una tarea vencida y planificada aparece solo en Vencido", () => {
    const t = task({ due_date: "2026-10-10", planned_on: today });
    const groups = groupTodayTasks([t], today);
    expect(ids(groups.overdue)).toEqual([t.id]);
    expect(groups.myDay).toEqual([]);
  });

  it("ordena por prioridad", () => {
    const low = task({ due_date: today, priority: 3 });
    const high = task({ due_date: today, priority: 1 });
    expect(ids(groupTodayTasks([low, high], today).dueToday)).toEqual([high.id, low.id]);
  });
});
