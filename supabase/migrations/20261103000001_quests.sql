-- Misiones (/quests): capa de juego sobre las tareas.
--
-- El valor de cada misión, las rachas y el avance se calculan en la app a partir
-- de tasks.completed_at; aquí solo se guarda lo que el usuario define (ajustes y
-- metas) y los logros ya desbloqueados (para celebrarlos una sola vez).

-- Lectura de tareas hechas por fecha (semana, mes, historial de rachas) ----------
create index tasks_done_completed_at_idx on public.tasks (user_id, completed_at)
  where status = 'done' and deleted_at is null;

-- Ajustes: una fila por usuario --------------------------------------------------
create table public.quest_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Misiones mínimas para que un día cuente en la racha.
  daily_min_tasks smallint not null default 3 check (daily_min_tasks between 1 and 20),
  -- Días laborables (0 = domingo … 6 = sábado): fuera de ellos no se rompe la racha.
  work_days smallint[] not null default '{1,2,3,4,5}'
    check (cardinality(work_days) between 1 and 7 and work_days <@ '{0,1,2,3,4,5,6}'::smallint[]),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint quest_settings_user_uniq unique (user_id)
);

create trigger set_updated_at before update on public.quest_settings
  for each row execute function public.set_updated_at();

alter table public.quest_settings enable row level security;
create policy "owner_select" on public.quest_settings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "owner_insert" on public.quest_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "owner_update" on public.quest_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.quest_settings from anon, authenticated;
grant select, insert, update on table public.quest_settings to authenticated;

-- Metas semanal y mensual en COP --------------------------------------------------
-- Cada cambio de meta queda con su fecha de inicio (lunes o día 1): los períodos
-- pasados conservan la meta que tenían.
create table public.quest_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  period text not null check (period in ('week', 'month')),
  target_cop bigint not null check (target_cop > 0),
  target_tasks integer check (target_tasks is null or target_tasks > 0),
  effective_from date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint quest_goals_period_start check (
    (period = 'week' and extract(isodow from effective_from) = 1)
    or (period = 'month' and extract(day from effective_from) = 1)
  ),
  constraint quest_goals_uniq unique (user_id, period, effective_from)
);

create trigger set_updated_at before update on public.quest_goals
  for each row execute function public.set_updated_at();

alter table public.quest_goals enable row level security;
create policy "owner_select" on public.quest_goals for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "owner_insert" on public.quest_goals for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "owner_update" on public.quest_goals for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.quest_goals from anon, authenticated;
grant select, insert, update on table public.quest_goals to authenticated;

-- Logros desbloqueados ------------------------------------------------------------
create table public.quest_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9-]+$'),
  unlocked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint quest_achievements_uniq unique (user_id, code)
);

create trigger set_updated_at before update on public.quest_achievements
  for each row execute function public.set_updated_at();

alter table public.quest_achievements enable row level security;
create policy "owner_select" on public.quest_achievements for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "owner_insert" on public.quest_achievements for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "owner_update" on public.quest_achievements for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.quest_achievements from anon, authenticated;
grant select, insert, update on table public.quest_achievements to authenticated;
