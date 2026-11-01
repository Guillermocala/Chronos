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
[Navegador] ── Web Speech API (voz → texto en el cliente) → dictado en Chronos
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
  - tres modalidades de cobro (`billing_type`):
    - `fixed`: monto total fijo;
    - `retainer`: "Mensual fijo", la mensualidad no depende de las horas;
    - `hourly_adjusted`: "Mensual por horas (OPS)", con mensualidad por N horas al mes; cada cuenta de cobro se liquida con las horas reales (ver **Liquidación OPS**);
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
  - **Tarifa real** = cobrado del contrato (sin pagos extra) ÷ (horas de alcance + soporte + directas), en `projectValuation`.
  - **Valor por ticket** (`ticketValue`): alcance = horas × tarifa; soporte = 0, con costo de oportunidad; extra facturable = horas × tarifa.
- **Tickets** (fase 3):
  - backlog por proyecto (pestaña Tickets);
  - kanban por sprint en `/projects/[id]/sprints/[sid]`, con dnd-kit: puntero, táctil y teclado, más un selector de estado en el celular;
  - orden con posiciones fraccionales (`lib/tickets/ordering.ts`);
  - detalle en `/tickets/[id]`.
- **Horas:**
  - cronómetro único por usuario (índice parcial en `time_entries`), visible arriba en todas las pantallas;
  - registro manual ("1:30", "90m"), en un ticket o **directo al proyecto** (sin ticket: operación, reuniones);
  - `time_entries.project_id` siempre está lleno: un trigger lo copia del ticket y, sin ticket, exige que el proyecto sea visible para quien registra (RLS);
  - las vistas `ticket_hours` y `project_hours` (`security_invoker`) suman las horas; `project_hours.direct_logged` son las horas sin ticket;
  - pestaña **Horas** del proyecto: horas por mes calendario (u horas por período de cobro en OPS), % frente a las horas pactadas y el registro directo.
- **Liquidación OPS** (`lib/billing/hours-settlement.ts`):
  - período de cada mensualidad: del día de cobro del mes anterior al día antes del cobro (cobro 28-nov → 28-oct a 27-nov);
  - valor = mensualidad ÷ horas pactadas × horas reales, proporcional en ambos sentidos y sin tope;
  - cuentan alcance, soporte y horas directas; los extras facturables no, porque se cobran aparte;
  - las mensualidades se generan con la mensualidad completa ("Estimado"). Al terminar el período aparecen como "Por liquidar". "Liquidar" (`settleMonthlyPayment`) guarda el valor, el período, `settled_hours` y `settled_at`, y el trigger actualiza el seguimiento "Cobrar…";
  - se puede volver a liquidar mientras el pago no esté recibido;
  - al editar el contrato, las mensualidades liquidadas se respetan igual que las recibidas (`planMonthlySync`);
  - "Copiar detalle" arma el texto de la cuenta de cobro.
- **Extras:** "Cobrar como extra" marca el ticket `extra` facturable y crea un pago `extra` esperado con `payments.ticket_id`; el trigger agrega su seguimiento "Cobrar…".
- **Tareas candidatas a ticket** (de los dictados) conservan `~Nh` en `tasks.estimated_hours`. "Convertir a ticket" crea el ticket y cierra la tarea.
- **Granola:**
  - las reglas de dictado viven en un solo lugar, `lib/granola/conventions.ts`:
    - secciones `## Tareas`, `## Seguimientos`, `## Tickets` y `## Notas`;
    - marcadores `@PREFIJO`, `!fecha`, `#prioridad`, `~3h`, `(esperando: X)` y enlaces de Drive;
  - el parser está en `lib/granola/parse.ts`; "+ Tarea" acepta los mismos marcadores;
  - `/guide` tiene las instrucciones para Granola, las plantillas y un probador;
  - `/import` muestra una vista previa editable (`components/granola/dictation-review.tsx`, compartida con el dictado por voz), guarda la nota en `meeting_notes` y crea los ítems. Las líneas de Tickets quedan como tareas `is_ticket_candidate` hasta la fase de tickets.
- **Dictado por voz en Chronos** (costo 0, todo en el navegador):
  - `hooks/use-speech-recognition.ts` usa la Web Speech API (`es-CO`). El audio lo procesa el navegador (Google en Chrome/Edge, Apple en Safari), nunca Vercel. Firefox no la soporta: el panel deja escribir el texto;
  - `lib/voice/normalize.ts` convierte lenguaje hablado en los marcadores de Granola ("dos horas" → `~2h`, "del proyecto web" → `@WEB`, "el viernes" → `!viernes`) y `parseLine` los interpreta. El vocabulario y los ejemplos de la guía viven en `lib/voice/vocabulary.ts` (con test de sincronía);
  - `components/voice/voice-dictation.tsx`: hoja inferior en el celular (< 768 px), diálogo en escritorio; pasos Dictar → Revisar bajo 1024 px y lado a lado desde 1024 px;
  - está en Hoy (entra a Mi día; `/today?dictate=1` lo abre), Tareas (lo que no tiene fecha va a la bandeja), Proyecto → Tareas (proyecto preasignado) e Importar ("Dictar aquí");
  - guarda con `importDictation` y `source = 'voice'` en `meeting_notes`. Hoy muestra el total estimado de Mi día y cada tarea su `~N h`;
  - pendiente para la PWA: atajo "Dictar" en el manifest y verificar el permiso de micrófono en modo instalado.
- **Cargar datos de otras plataformas** (Importar → "Cargar datos", o "Cargar datos ▾" en Tareas; `/import?tab=data&format=leden`):
  - Chronos es la fuente principal; la plataforma empresarial (Leden Company) es de soporte. Su "Informe de actividad" en PDF se carga para tener las mismas actividades y horas en ambos lados;
  - el PDF se lee en el navegador con `pdfjs-dist` (`lib/import/pdf-text.ts`, worker propio con `new Worker(new URL(...))`). El lector puro `lib/import/leden/parse.ts` arma las columnas por la posición x de los encabezados, une textos partidos en varias líneas y compara con el TOTAL y los "N registros" del informe;
  - formatos en `lib/import/formats.ts` (uno nuevo = un lector + una entrada);
  - cada registro → tarea `done` con `completed_at` en su fecha (12:00 Colombia) + `time_entries` directa al proyecto con `task_id`. Etiquetas: `leden`, el tipo (`reunion`, `produccion-entregable`…) y la etiqueta entre corchetes del descriptor (`[INICIATIVA ORIÓN]` → `iniciativa-orion`);
  - huella `tasks.external_source` + `external_id` (fecha|proyecto|horas|descripción normalizados, `#n` para idénticos) con índice único parcial: recargar un informe solo crea lo nuevo; borrar la tarea permite volver a cargarla. Si el registro se edita en Leden cambia la huella y entra como nuevo;
  - `external_project_links` recuerda el proyecto de Chronos de cada proyecto externo (va en el backup del proyecto);
  - la carga es atómica: RPC `import_external_activities` (security invoker) crea una nota `source = 'leden'` con la tabla resumen y las tareas y horas;
  - los registros no facturables quedan desmarcados por defecto para no sumar en la liquidación OPS;
  - borrar una tarea borra sus horas ligadas, y "Deshacer" las restaura.
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
  - **Estado: en pausa** (decisión del 2026-10-26). El canal principal es el navegador con vista responsive; la PWA queda como está, sin trabajo nuevo.
    - Qué hay:
      - manifest con `start_url` `/today` y atajos (Hoy, Nueva tarea, Importar dictado);
      - logo en `public/icons/chronos-logo.jpg` (reloj de arena blanco sobre `#343434`); `scripts/generate-icons.ts` genera desde él `app/icon.png` (favicon), `app/apple-icon.png`, los íconos del manifest y `public/icons/chronos-mark.png` (dibujo suelto que usan el sidebar y la imagen para compartir);
      - imagen para compartir en `app/opengraph-image.tsx`;
      - `components/pwa/register-sw.tsx` registra el service worker solo en producción;
      - las exclusiones van en el `matcher` de `proxy.ts`.
    - Verificado el 2026-10-26 en el build de producción: manifest, `sw.js`, `/offline` e íconos responden 200. Sin instalarla, la app funciona igual.
    - Pendientes para retomarla:
      - ~~logo definitivo~~ (incorporado el 2026-10-26);
      - probar la instalación en Android e iOS;
      - decidir si vale la pena una caché offline de lectura. Hoy no se cachea nada de la cuenta, a propósito, para no mostrar datos sin sesión;
      - revisar los atajos del manifest.
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
