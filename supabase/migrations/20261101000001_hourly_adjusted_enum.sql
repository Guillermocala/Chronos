-- Tercer tipo de cobro: mensualidad ajustada por horas reales (contratos tipo OPS).
-- Va sola: Postgres no permite usar un valor nuevo de enum en la misma transacción.
alter type public.billing_type add value if not exists 'hourly_adjusted';
