-- Las líneas dictadas como "ticket" (~3h) conservan su estimado hasta convertirse en ticket.
alter table public.tasks
  add column estimated_hours numeric(6, 2) check (estimated_hours >= 0);
