-- number y code los asigna siempre el trigger tickets_before_insert (PREFIJO-N).
-- Los defaults solo existen para que el insert no tenga que enviarlos (y los
-- tipos generados los marquen como opcionales); el trigger los sobrescribe.
alter table public.tickets alter column number set default 0;
alter table public.tickets alter column code set default '';
