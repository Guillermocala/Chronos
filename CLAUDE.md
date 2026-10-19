@AGENTS.md

# Chronos

Gestor personal de tickets, sprints y valor en COP. Lo usa una sola persona y la interfaz está en español.

- Arquitectura y diseño funcional: [docs/architecture.md](docs/architecture.md)
- Configuración del entorno: [docs/setup.md](docs/setup.md)

## Convenciones
- npm (no pnpm/yarn).
- Moneda: COP sin decimales. Formatear con `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`.
- Toda tabla nueva lleva `user_id` + RLS, `updated_at` con trigger y soft delete (`deleted_at`), porque los backups incrementales dependen de esto.
- Los cambios de esquema van siempre como migraciones en `supabase/migrations/`, nunca editados a mano en el dashboard.
