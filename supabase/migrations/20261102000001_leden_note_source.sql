-- Origen de nota para las cargas del informe de actividad de Leden Company.
-- Va sola: un valor de enum nuevo no se puede usar en la misma transacción.
alter type public.note_source add value if not exists 'leden';
