-- Archivar un proyecto (deleted_at) también descarta sus seguimientos de cobro
-- ("Cobrar mensualidad · …"). Antes solo se descartaban los de entrega, así que
-- los cobros pendientes de un proyecto archivado seguían apareciendo en "Hoy".
-- Los pagos no se tocan: son historial. Deshacer el archivo no reabre las tareas.

create or replace function public.projects_sync_follow_up()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted_at is not null then
    update public.tasks
       set status = 'dismissed'
     where project_id = new.id and auto_source in ('delivery', 'payment')
       and deleted_at is null and status in ('open', 'waiting');
    return new;
  end if;

  if new.phase = 'active' then
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

revoke execute on function public.projects_sync_follow_up() from public, anon, authenticated;

-- Reparación: cobros abiertos de proyectos que ya estaban archivados.
update public.tasks t
   set status = 'dismissed'
  from public.projects p
 where t.project_id = p.id
   and p.deleted_at is not null
   and t.auto_source = 'payment'
   and t.deleted_at is null
   and t.status in ('open', 'waiting');
