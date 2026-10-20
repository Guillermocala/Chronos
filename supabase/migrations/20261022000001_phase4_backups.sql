-- Fase 4: backups incrementales.

-- Último cambio de cada proyecto, mirando todas sus tablas relacionadas.
-- Incluye filas con soft delete (borrar también actualiza updated_at) y proyectos
-- archivados, para que el backup registre esos cambios. greatest() ignora nulls.
-- La usa scripts/backup.ts (rol postgres); no se expone al Data API.
create view public.project_last_change
with (security_invoker = true) as
select
  p.id as project_id,
  p.user_id,
  p.code_prefix,
  p.name,
  p.phase,
  p.deleted_at,
  greatest(
    p.updated_at,
    (select max(x.updated_at) from public.payments x where x.project_id = p.id),
    (select max(x.updated_at) from public.sprints x where x.project_id = p.id),
    (select max(x.updated_at) from public.tickets x where x.project_id = p.id),
    (select max(e.updated_at)
       from public.time_entries e
       join public.tickets t on t.id = e.ticket_id
      where t.project_id = p.id),
    (select max(x.updated_at) from public.tasks x where x.project_id = p.id),
    (select max(x.updated_at) from public.meeting_notes x where x.project_id = p.id),
    (select max(a.updated_at)
       from public.note_action_items a
       join public.meeting_notes n on n.id = a.note_id
      where n.project_id = p.id)
  ) as last_change_at
from public.projects p;

revoke all on public.project_last_change from anon, authenticated;

-- Historial de backups en Ajustes (más recientes primero).
create index backup_runs_started_at_idx on public.backup_runs (started_at desc);
