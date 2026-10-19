# Arquitectura de Chronos

Chronos es un gestor personal de tickets, sprints y valor en COP por proyecto. Lo usa una sola persona y se accede desde cualquier equipo.

```
[Navegador / PWA]
      │ HTTPS
[Vercel Hobby] ── Next.js (App Router): UI + Server Actions + /api/*     ← este repo
      │ supabase-js (sesión del usuario)        │ cron diario /api/health (evita la pausa de Supabase)
[Supabase Free] ── Postgres + Auth + RLS
      ▲ service key (solo en GitHub Actions)
[GitHub Actions] ── backup semanal / manual ──► repo privado chronos-backups (JSON + resumen.md)
[Google Drive] ── solo enlaces guardados en los tickets (sin API)
[Granola] ── notas exportadas en .md → importación en Chronos
```

## Repositorios
- **Chronos** (este): frontend y lógica de servidor juntos. Next.js resuelve las dos cosas, así que no hace falta un backend aparte. Incluye las migraciones SQL (`supabase/`), los scripts de backup y restauración (`scripts/`) y los workflows (`.github/workflows/`).
- **chronos-backups** (privado): solo datos exportados con su historial. Va separado del código a propósito.

## Stack
| Pieza | Tecnología |
|---|---|
| App | Next.js 16, React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui |
| Datos y auth | Supabase (Postgres, Auth, RLS) |
| Hosting | Vercel Hobby (uso personal, no comercial) |
| Validación | Zod, React Hook Form |
| Kanban | dnd-kit |
| Gráficas | Recharts |
| Markdown | remark / mdast |
| Tests | Vitest |

## Límites del plan gratuito a tener en cuenta
- **Supabase:** 2 proyectos activos y 500 MB de base de datos. Se pausa tras 7 días sin actividad; el cron de `/api/health` lo evita. Las migraciones deben incluir grants explícitos para PostgREST.
- **Vercel Hobby:** crons como máximo una vez al día (precisión de ±59 min). Uso no comercial.
- **GitHub Actions:** 2.000 min/mes en repos privados.

## Diseño funcional (resumen)
- **Proyectos:**
  - facturación `fixed` (monto fijo) o `retainer` (mensualidad);
  - fases `active` → `delivered`/`support` → `closed`;
  - ventana de soporte de 14 días por defecto;
  - enlace opcional a una carpeta de Drive.
- **Pagos:** anticipo, parcial, final, mensual o extra. Van independientes de la fase.
- **Tickets:**
  - `kind` scope/support/extra y `billable`;
  - un solo `doc_url` opcional (un Doc o una carpeta de Drive);
  - origen opcional en una nota de reunión.
- **Valor:** la tarifa estimada sale del monto o la mensualidad entre las horas. La tarifa real incluye las horas de soporte no facturable.
- **Granola:** se importa o pega un `.md`, se detectan los action items, se revisan y se convierten en tickets.
- **Backups:**
  - semanal (domingo 10 p. m., hora de Colombia) y manual desde la app;
  - incremental por proyecto: los proyectos sin cambios no se reexportan;
  - copia completa mensual;
  - `resumen.md` en cada ejecución;
  - script de restauración.
