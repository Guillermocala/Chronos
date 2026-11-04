-- Orden manual de "Mi día" (arrastrar / Subir / Bajar en Misiones y Hoy).
--
-- Posición fraccional como en tickets.position; null = sin orden (va al final,
-- por prioridad). Solo se usa para ordenar el grupo Mi día.

alter table public.tasks
  add column day_position double precision;
