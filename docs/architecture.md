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
  - `default_sprint_days` (duración de sprint por proyecto) y `billing_day` (día de cobro mensual).
- **Pagos:** anticipo, parcial, final, mensual o extra. Van independientes de la fase. En contrataciones mensuales con inicio y meses se generan automáticamente (`lib/payments.ts`).
- **Tareas y seguimientos** (`tasks`), distintas de los tickets:
  - `todo` (lo hago yo) o `follow_up` (espero algo de alguien: `waiting_on`);
  - `due_date` es la fecha límite y `planned_on` es "Mi día" (cuándo planeo hacerla);
  - proyecto opcional: sin proyecto = personal;
  - enlaces opcionales a ticket, nota, pago y Drive.
  - **No se usa un proyecto "Mi día":** los proyectos exigen facturación y contaminarían el valor.
- **Seguimientos automáticos** (triggers en la DB):
  - cada pago esperado con fecha crea "Cobrar …", que se completa al recibirlo;
  - entrar en soporte crea "Cerrar soporte · …", que se completa al cerrar el proyecto.
- **Vista Hoy** (`lib/tasks/today.ts`): Vencido, Mi día, Vence hoy, Seguimientos, Cobros y Soporte por cerrar (≤ 3 días).
- **Tickets:**
  - `kind` scope/support/extra y `billable`;
  - un solo `doc_url` opcional (un Doc o una carpeta de Drive);
  - origen opcional en una nota de reunión.
- **Valor:** la tarifa estimada sale del monto o la mensualidad entre las horas. La tarifa real incluye las horas de soporte no facturable.
  - **Tarifa real** = cobrado del contrato (sin pagos extra) ÷ (horas de alcance + soporte), en `projectValuation`.
  - **Valor por ticket** (`ticketValue`): alcance = horas × tarifa; soporte = 0, con costo de oportunidad; extra facturable = horas × tarifa.
- **Tickets** (fase 3):
  - backlog por proyecto (pestaña Tickets);
  - kanban por sprint en `/projects/[id]/sprints/[sid]`, con dnd-kit: puntero, táctil y teclado, más un selector de estado en el celular;
  - orden con posiciones fraccionales (`lib/tickets/ordering.ts`);
  - detalle en `/tickets/[id]`.
- **Horas:**
  - cronómetro único por usuario (índice parcial en `time_entries`), visible arriba en todas las pantallas;
  - registro manual ("1:30", "90m");
  - las vistas `ticket_hours` y `project_hours` (`security_invoker`) suman las horas.
- **Extras:** "Cobrar como extra" marca el ticket `extra` facturable y crea un pago `extra` esperado con `payments.ticket_id`; el trigger agrega su seguimiento "Cobrar…".
- **Tareas candidatas a ticket** (de los dictados) conservan `~Nh` en `tasks.estimated_hours`. "Convertir a ticket" crea el ticket y cierra la tarea.
- **Granola:**
  - las reglas de dictado viven en un solo lugar, `lib/granola/conventions.ts`:
    - secciones `## Tareas`, `## Seguimientos`, `## Tickets` y `## Notas`;
    - marcadores `@PREFIJO`, `!fecha`, `#prioridad`, `~3h`, `(esperando: X)` y enlaces de Drive;
  - el parser está en `lib/granola/parse.ts`; "+ Tarea" acepta los mismos marcadores;
  - `/guide` tiene las instrucciones para Granola, las plantillas y un probador;
  - `/import` muestra una vista previa editable, guarda la nota en `meeting_notes` y crea los ítems. Las líneas de Tickets quedan como tareas `is_ticket_candidate` hasta la fase de tickets.
- **Reportes** (fase 5):
  - `/reports`: cobros por mes, horas por semana, horas y tarifa por proyecto. Usa Recharts mediante el `chart` de shadcn, con los colores `--chart-1..5` validados con la skill dataviz y una tabla equivalente debajo de cada gráfica;
  - burndown en el tablero del sprint;
  - CSV para Excel (`;`, coma decimal, BOM) en `/api/reports/{hours,payments,sprint}.csv`;
  - lógica pura en `lib/reports/`.
- **Tareas recurrentes** (fase 6):
  - tabla `recurring_tasks` (diaria, semanal o mensual, cada N, anticipación);
  - la función `private.generate_recurring_tasks` corre cada día con **pg_cron** a las 6 a. m. y no crea alud de atrasadas;
  - la misma regla está en `lib/recurrence.ts`, con un test de paridad SQL/TS.
- **PWA:**
  - `app/manifest.ts`, íconos con `ImageResponse` y `public/sw.js`, que solo sirve la página `/offline` y no cachea datos;
  - el proxy deja públicos esos recursos.
- **Accesibilidad:**
  - enlace "Saltar al contenido", `prefers-reduced-motion` y foco visible;
  - las acciones destructivas ofrecen **Deshacer** en el aviso (`restoreDeleted`, solo tablas permitidas).
- **Notas:** `/notes` y `/notes/[id]` muestran los dictados importados con las tareas y tickets que salieron de cada uno.
- **Backups** (fase 4, `lib/backup/` + `scripts/backup.ts`/`restore.ts` + `.github/workflows/backup.yml`):
  - el script se conecta con `pg` vía `SUPABASE_DB_URL`;
  - la vista `project_last_change` decide qué proyectos exportar contra `manifest.json`;
  - el esquema se respalda como copia de `supabase/migrations/`;
  - la restauración genera SQL con `session_replication_role = replica` (sin triggers) y upsert por id;
  - el historial está en `backup_runs` (Ajustes → Backups); `/api/export` descarga todo en JSON con la sesión del usuario.
- **Backups (diseño original):**
  - semanal (domingo 10 p. m., hora de Colombia) y manual desde la app;
  - incremental por proyecto: los proyectos sin cambios no se reexportan;
  - copia completa mensual;
  - `resumen.md` en cada ejecución;
  - script de restauración.
