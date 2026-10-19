-- Esquema principal de Chronos.
-- Convenciones (ver CLAUDE.md): cada tabla lleva user_id + RLS, updated_at con
-- trigger y soft delete (deleted_at). No se concede DELETE: los borrados son
-- lógicos para que los backups incrementales los detecten.

-- Proyectos ------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  client text,
  code_prefix text not null check (code_prefix ~ '^[A-Z][A-Z0-9]{1,9}$'),
  color text,
  billing_type public.billing_type not null,
  -- fixed
  fixed_amount_cop bigint check (fixed_amount_cop >= 0),
  estimated_total_hours numeric(8, 2) check (estimated_total_hours >= 0),
  -- retainer
  monthly_fee_cop bigint check (monthly_fee_cop >= 0),
  expected_hours_per_month numeric(6, 2) check (expected_hours_per_month > 0),
  contract_months integer check (contract_months > 0),
  start_date date,
  end_date date,
  -- ciclo de vida y soporte post-entrega
  phase public.project_phase not null default 'active',
  delivered_at date,
  support_days integer not null default 14 check (support_days >= 0),
  support_until date,
  drive_folder_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint projects_fixed_requires_amount
    check (billing_type <> 'fixed' or fixed_amount_cop is not null),
  constraint projects_retainer_requires_fee
    check (billing_type <> 'retainer' or (monthly_fee_cop is not null and expected_hours_per_month is not null)),
  constraint projects_dates check (end_date is null or start_date is null or end_date >= start_date),
  constraint projects_code_prefix_unique unique (user_id, code_prefix)
);

-- Pagos ----------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id),
  kind public.payment_kind not null,
  amount_cop bigint not null check (amount_cop > 0),
  status public.payment_status not null default 'expected',
  due_date date,
  paid_at date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint payments_received_has_date check (status <> 'received' or paid_at is not null)
);

-- Sprints --------------------------------------------------------------------
create table public.sprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id),
  name text not null,
  goal text,
  start_date date not null,
  end_date date not null,
  is_support boolean not null default false,
  value_cop_override bigint check (value_cop_override >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sprints_dates check (end_date >= start_date)
);

-- Notas de reunión (Granola) -------------------------------------------------
create table public.meeting_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id),
  title text not null,
  meeting_date date not null default current_date,
  source public.note_source not null default 'granola',
  content_md text not null,
  attendees text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Tickets --------------------------------------------------------------------
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id),
  sprint_id uuid references public.sprints (id),
  number integer not null,
  code text not null,
  title text not null,
  description text,
  status public.ticket_status not null default 'backlog',
  priority smallint not null default 2 check (priority between 1 and 4),
  position double precision not null default 0,
  estimated_hours numeric(6, 2) check (estimated_hours >= 0),
  tags text[] not null default '{}',
  due_date date,
  kind public.ticket_kind not null default 'scope',
  billable boolean not null default true,
  source_note_id uuid references public.meeting_notes (id),
  doc_url text,
  doc_kind public.doc_kind,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint tickets_doc_kind_with_url check ((doc_url is null) = (doc_kind is null)),
  constraint tickets_number_unique unique (project_id, number),
  constraint tickets_code_unique unique (user_id, code)
);

-- Registro de horas ----------------------------------------------------------
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ticket_id uuid not null references public.tickets (id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  hours numeric(6, 2) check (hours > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint time_entries_range check (ended_at is null or ended_at >= started_at)
);

-- Action items de notas ------------------------------------------------------
create table public.note_action_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note_id uuid not null references public.meeting_notes (id),
  text text not null,
  position integer not null default 0,
  status public.action_item_status not null default 'pending',
  ticket_id uuid references public.tickets (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint note_action_items_converted_has_ticket check (status <> 'converted' or ticket_id is not null)
);

-- Historial de backups -------------------------------------------------------
-- Lo escribe el workflow de GitHub Actions con la secret key (que ignora RLS);
-- el panel lo lee con la sesión del usuario.
create table public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trigger public.backup_trigger not null,
  mode public.backup_mode not null,
  status public.backup_status not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  projects_exported integer not null default 0,
  projects_skipped integer not null default 0,
  summary_md text,
  commit_sha text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Índices --------------------------------------------------------------------
create index projects_user_id_idx on public.projects (user_id) where deleted_at is null;
create index payments_project_id_idx on public.payments (project_id);
create index payments_user_id_idx on public.payments (user_id);
create index sprints_project_id_idx on public.sprints (project_id);
create index sprints_user_id_idx on public.sprints (user_id);
create index meeting_notes_project_id_idx on public.meeting_notes (project_id);
create index meeting_notes_user_id_idx on public.meeting_notes (user_id);
create index tickets_project_id_idx on public.tickets (project_id);
create index tickets_sprint_id_idx on public.tickets (sprint_id);
create index tickets_user_id_idx on public.tickets (user_id);
create index tickets_source_note_id_idx on public.tickets (source_note_id);
create index time_entries_ticket_id_idx on public.time_entries (ticket_id);
create index time_entries_user_id_idx on public.time_entries (user_id);
create index note_action_items_note_id_idx on public.note_action_items (note_id);
create index note_action_items_ticket_id_idx on public.note_action_items (ticket_id);
create index note_action_items_user_id_idx on public.note_action_items (user_id);
create index backup_runs_user_id_idx on public.backup_runs (user_id, started_at desc);

-- updated_at, RLS, políticas y grants (mismo patrón en todas las tablas) -----
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'payments', 'sprints', 'meeting_notes', 'tickets',
    'time_entries', 'note_action_items', 'backup_runs'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);

    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy "owner_select" on public.%I for select to authenticated
         using ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "owner_insert" on public.%I for insert to authenticated
         with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "owner_update" on public.%I for update to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);

    -- Exposición explícita al Data API (requerida desde oct-2026).
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on table public.%I to authenticated', t);
  end loop;
end;
$$;

-- backup_runs: el usuario solo lo lee; lo escribe el workflow.
revoke insert, update on table public.backup_runs from authenticated;
drop policy "owner_insert" on public.backup_runs;
drop policy "owner_update" on public.backup_runs;

-- Reglas de negocio ----------------------------------------------------------

-- Proyectos: al marcar la entrega, calcula el fin de la ventana de soporte.
create or replace function public.projects_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.delivered_at is not null and new.support_until is null then
    new.support_until := new.delivered_at + new.support_days;
  end if;
  return new;
end;
$$;

create trigger projects_before_write
  before insert or update on public.projects
  for each row execute function public.projects_before_write();

-- Tickets: asigna número y código (PREFIJO-N) y mantiene done_at.
-- Si el proyecto ya fue entregado, el ticket entra como soporte no facturable
-- (salvo que se indique explícitamente otro kind).
create or replace function public.tickets_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_prefix text;
  v_delivered date;
begin
  select p.code_prefix, p.delivered_at
    into v_prefix, v_delivered
    from public.projects p
   where p.id = new.project_id;

  select coalesce(max(t.number), 0) + 1
    into new.number
    from public.tickets t
   where t.project_id = new.project_id;

  new.code := v_prefix || '-' || new.number;

  if v_delivered is not null and current_date >= v_delivered and new.kind = 'scope' then
    new.kind := 'support';
    new.billable := false;
  end if;

  if new.status = 'done' then
    new.done_at := coalesce(new.done_at, now());
  end if;

  return new;
end;
$$;

create trigger tickets_before_insert
  before insert on public.tickets
  for each row execute function public.tickets_before_insert();

create or replace function public.tickets_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' and old.status <> 'done' then
    new.done_at := now();
  elsif new.status <> 'done' then
    new.done_at := null;
  end if;
  return new;
end;
$$;

create trigger tickets_before_update
  before update on public.tickets
  for each row execute function public.tickets_before_update();

revoke execute on function public.projects_before_write() from public, anon, authenticated;
revoke execute on function public.tickets_before_insert() from public, anon, authenticated;
revoke execute on function public.tickets_before_update() from public, anon, authenticated;
