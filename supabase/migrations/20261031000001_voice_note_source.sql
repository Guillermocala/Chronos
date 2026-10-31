-- Dictados hechos por voz dentro de Chronos (además de Granola y manual).
alter type public.note_source add value if not exists 'voice';
