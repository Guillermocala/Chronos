-- Fase 3: tickets, cronómetro y horas por ticket/proyecto.

-- Cronómetro: una entrada "corriendo" no tiene ended_at ni hours. Solo una a la vez.
create unique index time_entries_one_running_uidx on public.time_entries (user_id)
  where ended_at is null and hours is null and deleted_at is null;

alter table public.time_entries
  add constraint time_entries_hours_max check (hours <= 24);

-- Un pago extra queda enlazado al ticket extra que lo origina.
alter table public.payments
  add column ticket_id uuid references public.tickets (id);
create index payments_ticket_id_idx on public.payments (ticket_id);

-- Orden del backlog y del kanban.
create index tickets_project_board_idx on public.tickets (project_id, status, position)
  where deleted_at is null;
create index tickets_sprint_board_idx on public.tickets (sprint_id, status, position)
  where deleted_at is null;

-- Horas registradas por ticket (solo entradas terminadas y no borradas).
-- security_invoker: la vista respeta el RLS del usuario que consulta.
create view public.ticket_hours
with (security_invoker = true) as
select
  t.id as ticket_id,
  t.project_id,
  coalesce(sum(e.hours) filter (where e.deleted_at is null and e.hours is not null), 0)::numeric(8, 2)
    as logged_hours
from public.tickets t
left join public.time_entries e on e.ticket_id = t.id
where t.deleted_at is null
group by t.id, t.project_id;

-- Resumen de horas por proyecto, por tipo de ticket.
create view public.project_hours
with (security_invoker = true) as
select
  t.project_id,
  coalesce(sum(t.estimated_hours) filter (where t.kind = 'scope'), 0)::numeric(10, 2) as scope_estimated,
  coalesce(sum(h.logged_hours) filter (where t.kind = 'scope'), 0)::numeric(10, 2) as scope_logged,
  coalesce(sum(h.logged_hours) filter (where t.kind = 'support'), 0)::numeric(10, 2) as support_logged,
  coalesce(sum(h.logged_hours) filter (where t.kind = 'extra'), 0)::numeric(10, 2) as extra_logged,
  count(*) filter (where t.status <> 'done')::integer as open_tickets,
  count(*) filter (where t.status = 'done')::integer as done_tickets
from public.tickets t
join public.ticket_hours h on h.ticket_id = t.id
where t.deleted_at is null
group by t.project_id;

revoke all on public.ticket_hours, public.project_hours from anon, authenticated;
grant select on public.ticket_hours, public.project_hours to authenticated;
