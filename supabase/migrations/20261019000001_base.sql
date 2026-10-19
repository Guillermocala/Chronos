-- Base: funciones utilitarias y tipos enum compartidos.

-- Mantiene updated_at al día (los backups incrementales dependen de él).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Keep-alive: /api/health lo llama a diario para que Supabase Free no pause el proyecto.
create or replace function public.ping()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

revoke execute on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;

-- Tipos
create type public.billing_type as enum ('fixed', 'retainer');
create type public.project_phase as enum ('active', 'delivered', 'support', 'closed');
create type public.payment_kind as enum ('advance', 'partial', 'final', 'monthly', 'extra');
create type public.payment_status as enum ('expected', 'received');
create type public.ticket_status as enum ('backlog', 'todo', 'in_progress', 'review', 'done');
create type public.ticket_kind as enum ('scope', 'support', 'extra');
create type public.doc_kind as enum ('doc', 'sheet', 'slides', 'folder', 'file');
create type public.note_source as enum ('granola', 'manual');
create type public.action_item_status as enum ('pending', 'converted', 'dismissed');
create type public.backup_trigger as enum ('scheduled', 'manual');
create type public.backup_mode as enum ('incremental', 'full');
create type public.backup_status as enum ('running', 'success', 'failed');
