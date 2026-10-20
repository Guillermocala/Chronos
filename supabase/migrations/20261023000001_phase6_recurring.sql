-- Fase 6: tareas recurrentes ("Enviar cuenta de cobro" cada mes, etc.).
-- La lógica de fechas replica lib/recurrence.ts (un test compara ambas).

create type public.recurrence_frequency as enum ('daily', 'weekly', 'monthly');

create table public.recurring_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  notes text,
  kind public.task_kind not null default 'todo',
  priority smallint not null default 2 check (priority between 1 and 3),
  waiting_on text,
  tags text[] not null default '{}',
  project_id uuid references public.projects (id),
  doc_url text,
  doc_kind public.doc_kind,
  frequency public.recurrence_frequency not null,
  interval smallint not null default 1 check (interval between 1 and 12),
  weekday smallint check (weekday between 0 and 6),
  month_day smallint check (month_day between 1 and 31),
  next_due date not null,
  lead_days smallint not null default 0 check (lead_days between 0 and 14),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint recurring_weekly_has_weekday check (frequency <> 'weekly' or weekday is not null),
  constraint recurring_monthly_has_day check (frequency <> 'monthly' or month_day is not null),
  constraint recurring_doc_kind_with_url check ((doc_url is null) = (doc_kind is null)),
  constraint recurring_waiting_only_follow_up check (kind = 'follow_up' or waiting_on is null)
);

create index recurring_tasks_user_id_idx on public.recurring_tasks (user_id);
create index recurring_tasks_project_id_idx on public.recurring_tasks (project_id);
create index recurring_tasks_due_idx on public.recurring_tasks (next_due)
  where active and deleted_at is null;

create trigger set_updated_at before update on public.recurring_tasks
  for each row execute function public.set_updated_at();

alter table public.recurring_tasks enable row level security;
create policy "owner_select" on public.recurring_tasks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "owner_insert" on public.recurring_tasks for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "owner_update" on public.recurring_tasks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on table public.recurring_tasks from anon, authenticated;
grant select, insert, update on table public.recurring_tasks to authenticated;

-- Cada tarea generada apunta a su regla; nunca dos tareas vivas para la misma fecha.
alter table public.tasks add column recurring_task_id uuid references public.recurring_tasks (id);
create index tasks_recurring_task_id_idx on public.tasks (recurring_task_id);
create unique index tasks_recurring_due_uidx on public.tasks (recurring_task_id, due_date)
  where recurring_task_id is not null and deleted_at is null;

-- Día `md` del mes que empieza en `month_start`, o el último día si el mes es más corto.
create or replace function public.clamp_month_day(month_start date, md integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select month_start + (least(md, extract(day from (month_start + interval '1 month - 1 day'))::integer) - 1);
$$;

-- Ocurrencia siguiente a `d` (que ya es una ocurrencia).
create or replace function public.next_occurrence(
  d date,
  freq public.recurrence_frequency,
  n integer,
  md integer
)
returns date
language sql
immutable
set search_path = ''
as $$
  select case freq
    when 'daily' then d + n
    when 'weekly' then d + 7 * n
    else public.clamp_month_day(
      (date_trunc('month', d) + make_interval(months => n))::date,
      coalesce(md, extract(day from d)::integer)
    )
  end;
$$;

-- Genera las tareas que tocan. p_user null = todos (cron); p_today solo para tests.
-- Si next_due quedó atrás, salta a la primera ocurrencia desde hoy (sin alud).
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.generate_recurring_tasks(p_user uuid, p_today date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recurring_tasks%rowtype;
  v_today date := coalesce(p_today, (now() at time zone 'America/Bogota')::date);
  v_next date;
  v_created integer := 0;
  v_rows integer;
  v_guard integer;
begin
  for r in
    select * from public.recurring_tasks
     where active and deleted_at is null and (p_user is null or user_id = p_user)
     for update
  loop
    v_next := r.next_due;
    v_guard := 0;
    while v_next < v_today and v_guard < 1000 loop
      v_next := public.next_occurrence(v_next, r.frequency, r.interval, r.month_day);
      v_guard := v_guard + 1;
    end loop;

    v_guard := 0;
    while v_next - r.lead_days <= v_today and v_guard < 60 loop
      insert into public.tasks (
        user_id, title, notes, kind, status, priority, due_date, waiting_on, tags,
        project_id, doc_url, doc_kind, recurring_task_id
      ) values (
        r.user_id, r.title, r.notes, r.kind,
        case when r.kind = 'follow_up' and r.waiting_on is not null then 'waiting'::public.task_status
             else 'open'::public.task_status end,
        r.priority, v_next, r.waiting_on, r.tags, r.project_id, r.doc_url, r.doc_kind, r.id
      )
      on conflict (recurring_task_id, due_date) where recurring_task_id is not null and deleted_at is null
      do nothing;
      get diagnostics v_rows = row_count;
      v_created := v_created + v_rows;
      v_next := public.next_occurrence(v_next, r.frequency, r.interval, r.month_day);
      v_guard := v_guard + 1;
    end loop;

    if v_next <> r.next_due then
      update public.recurring_tasks set next_due = v_next where id = r.id;
    end if;
  end loop;
  return v_created;
end;
$$;

revoke execute on function private.generate_recurring_tasks(uuid, date) from public, anon, authenticated;

-- Para la app: genera solo las del usuario de la sesión (al guardar una regla).
create or replace function public.generate_my_recurring_tasks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return 0;
  end if;
  return private.generate_recurring_tasks((select auth.uid()));
end;
$$;

revoke execute on function public.generate_my_recurring_tasks() from public, anon;
grant execute on function public.generate_my_recurring_tasks() to authenticated;

-- Generación diaria a las 6 a. m. de Colombia (11:00 UTC) con pg_cron (incluido en
-- Supabase Free). Si la extensión no existe (tests con PGlite), se omite.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'chronos-recurring',
      '0 11 * * *',
      'select private.generate_recurring_tasks(null)'
    );
  end if;
end;
$$;

-- Backups incrementales: un cambio en una regla recurrente también cuenta como
-- cambio de su proyecto.
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
    (select max(e.updated_at)
       from public.time_entries e
       join public.tickets t on t.id = e.ticket_id
      where t.project_id = p.id),
    (select max(x.updated_at) from public.tasks x where x.project_id = p.id),
    (select max(x.updated_at) from public.meeting_notes x where x.project_id = p.id),
    (select max(a.updated_at)
       from public.note_action_items a
       join public.meeting_notes n on n.id = a.note_id
      where n.project_id = p.id),
    (select max(x.updated_at) from public.recurring_tasks x where x.project_id = p.id)
  ) as last_change_at
from public.projects p;

revoke all on public.project_last_change from anon, authenticated;
