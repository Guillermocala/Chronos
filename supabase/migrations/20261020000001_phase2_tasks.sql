-- Fase 2: tareas y seguimientos, seguimientos automáticos, sprint por defecto y día de cobro.

-- Proyectos y pagos ------------------------------------------------------------
alter table public.projects
  add column default_sprint_days smallint not null default 14
    check (default_sprint_days between 1 and 60),
  add column billing_day smallint
    check (billing_day between 1 and 28);

create index payments_pending_idx on public.payments (user_id, due_date)
  where status = 'expected' and deleted_at is null;

-- Tareas -----------------------------------------------------------------------
create type public.task_kind as enum ('todo', 'follow_up');
create type public.task_status as enum ('open', 'waiting', 'done', 'dismissed');
create type public.task_auto_source as enum ('delivery', 'payment');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  notes text,
  kind public.task_kind not null default 'todo',
  status public.task_status not null default 'open',
  priority smallint not null default 2 check (priority between 1 and 3),
  due_date date,
  -- "Mi día": el día en que planeo hacerla (distinto de la fecha límite).
  planned_on date,
  waiting_on text,
  tags text[] not null default '{}',
  project_id uuid references public.projects (id),
  ticket_id uuid references public.tickets (id),
  source_note_id uuid references public.meeting_notes (id),
  payment_id uuid references public.payments (id),
  doc_url text,
  doc_kind public.doc_kind,
  -- Línea dictada como "ticket": se convertirá cuando exista el módulo de tickets.
  is_ticket_candidate boolean not null default false,
  auto_source public.task_auto_source,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint tasks_doc_kind_with_url check ((doc_url is null) = (doc_kind is null)),
  constraint tasks_waiting_only_follow_up check (kind = 'follow_up' or waiting_on is null)
);

create index tasks_open_planned_idx on public.tasks (user_id, planned_on)
  where status in ('open', 'waiting') and deleted_at is null;
create index tasks_open_due_idx on public.tasks (user_id, due_date)
  where status in ('open', 'waiting') and deleted_at is null;
create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_project_id_idx on public.tasks (project_id);
create index tasks_ticket_id_idx on public.tasks (ticket_id);
create index tasks_source_note_id_idx on public.tasks (source_note_id);
create index tasks_payment_id_idx on public.tasks (payment_id);
-- Un solo seguimiento automático activo por pago / por entrega de proyecto.
create unique index tasks_auto_payment_uidx on public.tasks (payment_id)
  where auto_source = 'payment' and deleted_at is null;
create unique index tasks_auto_delivery_uidx on public.tasks (project_id)
  where auto_source = 'delivery' and deleted_at is null;

create trigger set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

create policy "owner_select" on public.tasks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "owner_insert" on public.tasks for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "owner_update" on public.tasks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.tasks from anon, authenticated;
grant select, insert, update on table public.tasks to authenticated;

-- completed_at sigue al estado.
create or replace function public.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' then
    new.completed_at := coalesce(
      case when tg_op = 'UPDATE' and old.status = 'done' then old.completed_at end,
      now()
    );
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

-- Seguimientos automáticos: pagos ------------------------------------------------
-- Cada pago esperado con fecha tiene un seguimiento "Cobrar ..."; se completa al
-- recibir el pago y se descarta si el pago se borra.
create or replace function public.payments_sync_follow_up()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_project text;
  v_title text;
begin
  if new.deleted_at is not null then
    update public.tasks
       set status = 'dismissed'
     where payment_id = new.id and auto_source = 'payment'
       and deleted_at is null and status in ('open', 'waiting');
    return new;
  end if;

  if new.status = 'received' then
    update public.tasks
       set status = 'done'
     where payment_id = new.id and auto_source = 'payment'
       and deleted_at is null and status in ('open', 'waiting');
    return new;
  end if;

  if new.due_date is null then
    return new;
  end if;

  select p.name into v_project from public.projects p where p.id = new.project_id;

  v_title := 'Cobrar '
    || case new.kind
         when 'advance' then 'anticipo'
         when 'partial' then 'pago parcial'
         when 'final' then 'pago final'
         when 'monthly' then 'mensualidad'
         else 'pago extra'
       end
    || ' · ' || coalesce(v_project, 'proyecto')
    || ' ($ ' || replace(to_char(new.amount_cop, 'FM999,999,999,999'), ',', '.') || ')';

  update public.tasks
     set title = v_title,
         due_date = new.due_date,
         project_id = new.project_id,
         status = case
           when tg_op = 'UPDATE' and old.status = 'received' then 'open'::public.task_status
           else status
         end
   where payment_id = new.id and auto_source = 'payment' and deleted_at is null;

  if not found then
    insert into public.tasks (user_id, title, kind, due_date, project_id, payment_id, auto_source)
    values (new.user_id, v_title, 'follow_up', new.due_date, new.project_id, new.id, 'payment');
  end if;

  return new;
end;
$$;

create trigger payments_sync_follow_up
  after insert or update on public.payments
  for each row execute function public.payments_sync_follow_up();

-- Seguimientos automáticos: entrega / soporte --------------------------------------
-- Al entrar en soporte se crea "Cerrar soporte · <proyecto>" para support_until;
-- se completa al cerrar el proyecto y se descarta si se reabre o archiva.
create or replace function public.projects_sync_follow_up()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted_at is not null or new.phase = 'active' then
    update public.tasks
       set status = 'dismissed'
     where project_id = new.id and auto_source = 'delivery'
       and deleted_at is null and status in ('open', 'waiting');
    return new;
  end if;

  if new.phase = 'closed' then
    update public.tasks
       set status = 'done'
     where project_id = new.id and auto_source = 'delivery'
       and deleted_at is null and status in ('open', 'waiting');
    return new;
  end if;

  if new.phase = 'support' and new.support_until is not null then
    update public.tasks
       set title = 'Cerrar soporte · ' || new.name,
           due_date = new.support_until,
           status = case
             when tg_op = 'UPDATE' and old.phase is distinct from 'support' then 'open'::public.task_status
             else status
           end
     where project_id = new.id and auto_source = 'delivery' and deleted_at is null;

    if not found then
      insert into public.tasks (user_id, title, kind, due_date, project_id, auto_source)
      values (new.user_id, 'Cerrar soporte · ' || new.name, 'follow_up',
              new.support_until, new.id, 'delivery');
    end if;
  end if;

  return new;
end;
$$;

create trigger projects_sync_follow_up
  after insert or update of phase, support_until, name, deleted_at on public.projects
  for each row execute function public.projects_sync_follow_up();

revoke execute on function public.tasks_before_write() from public, anon, authenticated;
revoke execute on function public.payments_sync_follow_up() from public, anon, authenticated;
revoke execute on function public.projects_sync_follow_up() from public, anon, authenticated;
