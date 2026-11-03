-- Horas reales de tareas personales (sin proyecto).
--
-- Al completar una tarea sin estimado, la app pregunta cuánto tomó. En tareas de
-- proyecto eso va a time_entries (con task_id) y cuenta en las horas del
-- proyecto; las personales no pueden tener time_entries (exigen ticket o
-- proyecto), así que se guardan aquí, solo como registro.

alter table public.tasks
  add column spent_hours numeric(6,2)
    constraint tasks_spent_hours_range check (spent_hours is null or (spent_hours > 0 and spent_hours <= 1000));
