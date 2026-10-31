-- Mensual ajustado por horas (OPS) + horas registradas directo al proyecto.
--
-- Liquidación: valor = mensualidad / horas pactadas × horas reales del período
-- (del día de cobro anterior al día antes del cobro). Se calcula en la app
-- (lib/billing/hours-settlement.ts) y queda registrada en el pago.

-- Proyectos: OPS exige mensualidad y horas por mes, igual que la mensual fija.
alter table public.projects drop constraint projects_retainer_requires_fee;
alter table public.projects add constraint projects_retainer_requires_fee
  check (
    billing_type not in ('retainer', 'hourly_adjusted')
    or (monthly_fee_cop is not null and expected_hours_per_month is not null)
  );

-- Registro de horas: con ticket o directo al proyecto -------------------------
alter table public.time_entries
  add column project_id uuid references public.projects (id);

update public.time_entries e
   set project_id = t.project_id
  from public.tickets t
 where t.id = e.ticket_id and e.project_id is null;

alter table public.time_entries alter column ticket_id drop not null;
alter table public.time_entries
  add constraint time_entries_ticket_or_project check (ticket_id is not null or project_id is not null);

create index time_entries_project_started_idx on public.time_entries (project_id, started_at);

-- El proyecto se toma siempre del ticket. Sin ticket, el proyecto debe ser
-- visible para quien registra (RLS: security invoker), así no se cargan horas
-- a proyectos de otro usuario.
create or replace function public.time_entries_set_project()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ticket_id is not null then
    select t.project_id into new.project_id from public.tickets t where t.id = new.ticket_id;
    if new.project_id is null then
      raise exception 'Ticket no encontrado.' using errcode = '23503';
    end if;
  elsif not exists (select 1 from public.projects p where p.id = new.project_id) then
    raise exception 'Proyecto no encontrado.' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger time_entries_set_project
  before insert or update of ticket_id, project_id on public.time_entries
  for each row execute function public.time_entries_set_project();

-- Pagos: datos de la liquidación por horas -----------------------------------
alter table public.payments
  add column period_start date,
  add column period_end date,
  add column settled_hours numeric(7, 2) check (settled_hours >= 0),
  add column settled_at timestamptz,
  add constraint payments_period check (period_end is null or period_start is null or period_end >= period_start);

-- Resumen de horas por proyecto: agrega las horas directas (sin ticket) y
-- cuenta también proyectos sin tickets.
drop view public.project_hours;
create view public.project_hours
with (security_invoker = true) as
with by_ticket as (
  select
    t.project_id,
    coalesce(sum(t.estimated_hours) filter (where t.kind = 'scope'), 0) as scope_estimated,
    coalesce(sum(h.logged_hours) filter (where t.kind = 'scope'), 0) as scope_logged,
    coalesce(sum(h.logged_hours) filter (where t.kind = 'support'), 0) as support_logged,
    coalesce(sum(h.logged_hours) filter (where t.kind = 'extra'), 0) as extra_logged,
    count(*) filter (where t.status <> 'done') as open_tickets,
    count(*) filter (where t.status = 'done') as done_tickets
  from public.tickets t
  join public.ticket_hours h on h.ticket_id = t.id
  where t.deleted_at is null
  group by t.project_id
),
direct as (
  select e.project_id, sum(e.hours) as direct_logged
  from public.time_entries e
  where e.ticket_id is null and e.deleted_at is null and e.hours is not null
  group by e.project_id
)
select
  coalesce(t.project_id, d.project_id) as project_id,
  coalesce(t.scope_estimated, 0)::numeric(10, 2) as scope_estimated,
  coalesce(t.scope_logged, 0)::numeric(10, 2) as scope_logged,
  coalesce(t.support_logged, 0)::numeric(10, 2) as support_logged,
  coalesce(t.extra_logged, 0)::numeric(10, 2) as extra_logged,
  coalesce(t.open_tickets, 0)::integer as open_tickets,
  coalesce(t.done_tickets, 0)::integer as done_tickets,
  coalesce(d.direct_logged, 0)::numeric(10, 2) as direct_logged
from by_ticket t
full join direct d on d.project_id = t.project_id;

revoke all on public.project_hours from anon, authenticated;
grant select on public.project_hours to authenticated;

-- Backups incrementales: los registros de horas se asocian por project_id.
create or replace view public.project_last_change
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
    (select max(e.updated_at) from public.time_entries e where e.project_id = p.id),
    (select max(x.updated_at) from public.tasks x where x.project_id = p.id),
    (select max(x.updated_at) from public.meeting_notes x where x.project_id = p.id),
    (select max(a.updated_at)
       from public.note_action_items a
       join public.meeting_notes n on n.id = a.note_id
      where n.project_id = p.id),
    (select max(x.updated_at) from public.recurring_tasks x where x.project_id = p.id)
  ) as last_change_at
from public.projects p;
