-- Carga de actividades desde plataformas externas (Leden Company).
--
-- Cada registro del informe crea una tarea hecha en su fecha + sus horas
-- directas al proyecto. La huella (external_source, external_id) evita cargar
-- dos veces el mismo registro, y el mapeo "proyecto externo → proyecto" se
-- recuerda para la siguiente carga.

-- Tareas: huella del registro externo ----------------------------------------
alter table public.tasks
  add column external_source text,
  add column external_id text,
  add constraint tasks_external_ref check ((external_source is null) = (external_id is null));

create unique index tasks_external_uidx on public.tasks (user_id, external_source, external_id)
  where deleted_at is null and external_source is not null;

-- completed_at: al crear una tarea ya hecha se respeta la fecha que llega
-- (actividades históricas); en los demás casos sigue igual.
create or replace function public.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' then
    new.completed_at := case
      when tg_op = 'INSERT' then coalesce(new.completed_at, now())
      when old.status = 'done' then coalesce(old.completed_at, now())
      else now()
    end;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.tasks_before_write() from public, anon, authenticated;

-- Horas ligadas a una tarea ----------------------------------------------------
alter table public.time_entries
  add column task_id uuid references public.tasks (id);

create index time_entries_task_id_idx on public.time_entries (task_id) where task_id is not null;

-- La tarea, como el proyecto, debe ser visible para quien registra (RLS).
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
  if new.task_id is not null and not exists (select 1 from public.tasks t where t.id = new.task_id) then
    raise exception 'Tarea no encontrada.' using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger time_entries_set_project on public.time_entries;
create trigger time_entries_set_project
  before insert or update of ticket_id, project_id, task_id on public.time_entries
  for each row execute function public.time_entries_set_project();

-- Mapeo de proyectos externos ----------------------------------------------------
create table public.external_project_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null check (length(trim(source)) > 0),
  external_name text not null check (length(trim(external_name)) > 0),
  project_id uuid not null references public.projects (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index external_project_links_uidx
  on public.external_project_links (user_id, source, lower(external_name))
  where deleted_at is null;
create index external_project_links_project_id_idx on public.external_project_links (project_id);

create trigger set_updated_at before update on public.external_project_links
  for each row execute function public.set_updated_at();

alter table public.external_project_links enable row level security;

create policy "owner_select" on public.external_project_links for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "owner_insert" on public.external_project_links for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "owner_update" on public.external_project_links for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.external_project_links from anon, authenticated;
grant select, insert, update on table public.external_project_links to authenticated;

-- Carga atómica ------------------------------------------------------------------
-- p_note:  {title, meeting_date, content_md}
-- p_links: [{external_name, project_id}]
-- p_rows:  [{external_id, date, title, notes, tags, hours, project_id}]
-- Devuelve {created, skipped, hours, note_id}. Corre con los permisos de quien
-- llama (RLS): un proyecto ajeno falla en el trigger de horas.
create or replace function public.import_external_activities(
  p_source text,
  p_note jsonb,
  p_links jsonb,
  p_rows jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total integer;
  v_new integer;
  v_note uuid;
  v_project uuid;
  v_created integer := 0;
  v_hours numeric := 0;
begin
  if p_source is null or length(trim(p_source)) = 0 then
    raise exception 'Origen requerido.' using errcode = '22023';
  end if;

  insert into public.external_project_links (source, external_name, project_id)
  select p_source, trim(l.external_name), l.project_id
    from jsonb_to_recordset(coalesce(p_links, '[]'::jsonb)) as l(external_name text, project_id uuid)
  on conflict (user_id, source, lower(external_name)) where deleted_at is null
  do update set project_id = excluded.project_id
    where public.external_project_links.project_id is distinct from excluded.project_id;

  select count(*),
         count(*) filter (where not exists (
           select 1 from public.tasks t
            where t.external_source = p_source and t.external_id = r.external_id and t.deleted_at is null
         )),
         case when count(distinct r.project_id) = 1 then min(r.project_id::text)::uuid end
    into v_total, v_new, v_project
    from jsonb_to_recordset(p_rows) as r(external_id text, project_id uuid);

  if v_new = 0 then
    return jsonb_build_object('created', 0, 'skipped', v_total, 'hours', 0, 'note_id', null);
  end if;

  insert into public.meeting_notes (title, meeting_date, source, content_md, project_id)
  values (
    p_note->>'title',
    coalesce((p_note->>'meeting_date')::date, current_date),
    p_source::public.note_source,
    coalesce(p_note->>'content_md', ''),
    v_project
  )
  returning id into v_note;

  with input as (
    select *
      from jsonb_to_recordset(p_rows) as r(
        external_id text, date date, title text, notes text, tags text[], hours numeric, project_id uuid
      )
  ),
  ins as (
    insert into public.tasks (
      title, notes, kind, status, priority, tags, project_id, source_note_id,
      completed_at, external_source, external_id
    )
    select r.title, r.notes, 'todo', 'done', 2, coalesce(r.tags, '{}'), r.project_id, v_note,
           (r.date::text || ' 12:00:00-05')::timestamptz, p_source, r.external_id
      from input r
    on conflict (user_id, external_source, external_id)
      where deleted_at is null and external_source is not null
      do nothing
    returning id, external_id, project_id, completed_at
  ),
  te as (
    insert into public.time_entries (project_id, task_id, started_at, ended_at, hours, note)
    select ins.project_id, ins.id, ins.completed_at, ins.completed_at, r.hours, r.title
      from ins join input r on r.external_id = ins.external_id
    returning hours
  )
  select count(*), coalesce(sum(te.hours), 0) into v_created, v_hours from te;

  return jsonb_build_object(
    'created', v_created,
    'skipped', v_total - v_created,
    'hours', v_hours,
    'note_id', v_note
  );
end;
$$;

revoke execute on function public.import_external_activities(text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.import_external_activities(text, jsonb, jsonb, jsonb) to authenticated;

-- Backups incrementales: un cambio en el mapeo cuenta como cambio del proyecto.
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
    (select max(x.updated_at) from public.recurring_tasks x where x.project_id = p.id),
    (select max(x.updated_at) from public.external_project_links x where x.project_id = p.id)
  ) as last_change_at
from public.projects p;
