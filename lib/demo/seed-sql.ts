// SQL de datos de prueba ("[DEMO]") para revisar la app con un usuario real.
// Lo usa scripts/seed-demo.ts. Todo queda marcado para poder retirarlo con
// buildDemoResetSql (soft delete, como el resto de la app).
//
// Las fechas son relativas a `today` para que los escenarios no envejezcan.
// Los seguimientos "Cobrar…", "Cerrar soporte…" y las tareas recurrentes los
// crean los triggers y el generador de la base, igual que en la app.

import { addDays, type ISODate } from "@/lib/dates";
import { buildMonthlySchedule } from "@/lib/payments";

export const DEMO_TAG = "[DEMO]";
export const DEMO_PREFIXES = ["DMRET", "DMOLD", "DMNEW", "DMFIX", "DMSOP"] as const;

const lit = (value: string) => `'${value.replace(/'/g, "''")}'`;
const date = (iso: ISODate) => `${lit(iso)}::date`;
const ts = (iso: ISODate, hour: number) => `${lit(`${iso} ${String(hour).padStart(2, "0")}:00:00-05`)}::timestamptz`;

function shiftMonths(iso: ISODate, months: number): ISODate {
  const [y, m, d] = iso.split("-").map(Number);
  const index = y * 12 + (m - 1) + months;
  const day = Math.min(d, 28);
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Calendario con la regla anterior (primer cobro el mismo día del inicio), para probar la corrección. */
function legacySchedule(start: ISODate, months: number, fee: number) {
  return Array.from({ length: months }, (_, i) => ({ due_date: shiftMonths(start, i), amount_cop: fee }));
}

const userLookup = (email: string) => `
  select id into v_uid from auth.users where lower(email) = lower(${lit(email)});
  if v_uid is null then
    raise exception 'No existe un usuario con el email %', ${lit(email)};
  end if;`;

export function buildDemoSeedSql({ email, today }: { email: string; today: ISODate }): string {
  const day = Number(today.slice(8, 10));

  // 1) Mensual en curso: inicio hace 4 meses, cobro el 15, 6 meses. Dos recibidos, dos vencidos.
  const retStart = shiftMonths(today, -4);
  const retFee = 4_500_000;
  const retSchedule = buildMonthlySchedule({
    start_date: retStart,
    contract_months: 6,
    monthly_fee_cop: retFee,
    billing_day: 15,
  });
  const retPayments = retSchedule.map((p, i) => {
    const received = i < 2;
    return `(v_uid, p_ret, 'monthly', ${retFee}, '${received ? "received" : "expected"}', ${date(p.due_date!)}, ${
      received ? date(addDays(p.due_date!, 2)) : "null"
    })`;
  });

  // 2) Mensual con fechas de la regla vieja (primer cobro = inicio): al editarlo, la confirmación debe proponer corregirlas.
  const oldStart = shiftMonths(today, -1).slice(0, 8) + "01";
  const oldFee = 2_800_000;
  const oldPayments = legacySchedule(oldStart, 4, oldFee).map(
    (p) => `(v_uid, p_old, 'monthly', ${p.amount_cop}, 'expected', ${date(p.due_date)}, null)`,
  );

  // 3) Mensual nuevo que empieza hoy con día de cobro = hoy: el primer cobro debe caer el mes siguiente.
  const newFee = 3_200_000;
  const newBillingDay = Math.min(day, 28);
  const newPayments = buildMonthlySchedule({
    start_date: today,
    contract_months: 3,
    monthly_fee_cop: newFee,
    billing_day: newBillingDay,
  }).map((p) => `(v_uid, p_new, 'monthly', ${newFee}, 'expected', ${date(p.due_date!)}, null)`);

  // 4) Precio fijo en desarrollo.
  const fixStart = addDays(today, -35);
  const sprint1 = { start: fixStart, end: addDays(fixStart, 13) };
  const sprint2 = { start: addDays(fixStart, 14), end: addDays(fixStart, 27) };
  const sprint3 = { start: addDays(fixStart, 28), end: addDays(fixStart, 41) };

  // 5) Entregado hace 5 días, 14 días de soporte.
  const sopStart = addDays(today, -90);
  const sopDelivered = addDays(today, -5);

  return `-- Datos de prueba ${DEMO_TAG} para ${email} (generado para ${today}).
-- Se retiran con: npm run db:seed-demo -- --email ${email} --reset --apply
begin;

do $seed$
declare
  v_uid uuid;
  p_ret uuid; p_old uuid; p_new uuid; p_fix uuid; p_sop uuid;
  s1 uuid; s2 uuid; s3 uuid; s_sup uuid;
  t1 uuid; t2 uuid; t3 uuid; t4 uuid; t5 uuid; t_sop uuid;
  n1 uuid;
begin
  ${userLookup(email)}

  if exists (
    select 1 from public.projects
     where user_id = v_uid and code_prefix in (${DEMO_PREFIXES.map(lit).join(", ")})
  ) then
    raise exception 'Ya hay datos ${DEMO_TAG} para este usuario. Retíralos primero con --reset.';
  end if;

  -- 1) Mensual en curso -------------------------------------------------------
  insert into public.projects (user_id, name, client, code_prefix, color, billing_type, monthly_fee_cop,
                               expected_hours_per_month, contract_months, billing_day, start_date, end_date)
  values (v_uid, '${DEMO_TAG} Retainer en curso', 'Cliente Demo SAS', 'DMRET', '#0ea5e9', 'retainer', ${retFee},
          40, 6, 15, ${date(retStart)}, ${date(shiftMonths(retStart, 6))})
  returning id into p_ret;

  insert into public.payments (user_id, project_id, kind, amount_cop, status, due_date, paid_at) values
    ${retPayments.join(",\n    ")};

  insert into public.tickets (user_id, project_id, title, status, priority, estimated_hours, tags) values
    (v_uid, p_ret, 'Soporte mensual: actualizar dependencias', 'in_progress', 2, 4, '{mantenimiento}'),
    (v_uid, p_ret, 'Reporte mensual de analítica', 'todo', 3, 2, '{reporte}'),
    (v_uid, p_ret, 'Ajustar formulario de contacto', 'done', 2, 3, '{web}');

  insert into public.recurring_tasks (user_id, title, kind, priority, project_id, frequency, interval,
                                      weekday, next_due, lead_days, tags)
  values (v_uid, '${DEMO_TAG} Enviar informe semanal al cliente', 'todo', 2, p_ret, 'weekly', 1,
          1, ${date(today)}, 1, '{demo}');

  -- 2) Mensual con fechas de la regla anterior ---------------------------------
  insert into public.projects (user_id, name, client, code_prefix, color, billing_type, monthly_fee_cop,
                               expected_hours_per_month, contract_months, billing_day, start_date)
  values (v_uid, '${DEMO_TAG} Retainer con fechas viejas', 'Estudio Demo', 'DMOLD', '#a855f7', 'retainer', ${oldFee},
          24, 4, 1, ${date(oldStart)})
  returning id into p_old;

  insert into public.payments (user_id, project_id, kind, amount_cop, status, due_date, paid_at) values
    ${oldPayments.join(",\n    ")};

  -- 3) Mensual que empieza hoy --------------------------------------------------
  insert into public.projects (user_id, name, client, code_prefix, color, billing_type, monthly_fee_cop,
                               expected_hours_per_month, contract_months, billing_day, start_date)
  values (v_uid, '${DEMO_TAG} Retainer nuevo', 'Startup Demo', 'DMNEW', '#22c55e', 'retainer', ${newFee},
          30, 3, ${newBillingDay}, ${date(today)})
  returning id into p_new;

  insert into public.payments (user_id, project_id, kind, amount_cop, status, due_date, paid_at) values
    ${newPayments.join(",\n    ")};

  -- 4) Precio fijo con sprints, tickets y horas ---------------------------------
  insert into public.projects (user_id, name, client, code_prefix, color, billing_type, fixed_amount_cop,
                               estimated_total_hours, start_date, end_date, default_sprint_days)
  values (v_uid, '${DEMO_TAG} Proyecto fijo', 'Tienda Demo', 'DMFIX', '#f97316', 'fixed', 18000000,
          160, ${date(fixStart)}, ${date(addDays(today, 30))}, 14)
  returning id into p_fix;

  insert into public.payments (user_id, project_id, kind, amount_cop, status, due_date, paid_at, note) values
    (v_uid, p_fix, 'advance', 9000000, 'received', ${date(fixStart)}, ${date(fixStart)}, 'Anticipo 50 %'),
    (v_uid, p_fix, 'partial', 4500000, 'expected', ${date(addDays(today, 7))}, null, 'Hito: catálogo publicado');

  insert into public.sprints (user_id, project_id, name, goal, start_date, end_date) values
    (v_uid, p_fix, 'Sprint 1', 'Diseño y maquetación base', ${date(sprint1.start)}, ${date(sprint1.end)})
  returning id into s1;
  insert into public.sprints (user_id, project_id, name, goal, start_date, end_date) values
    (v_uid, p_fix, 'Sprint 2', 'Catálogo y carrito', ${date(sprint2.start)}, ${date(sprint2.end)})
  returning id into s2;
  insert into public.sprints (user_id, project_id, name, goal, start_date, end_date) values
    (v_uid, p_fix, 'Sprint 3', 'Pagos y lanzamiento', ${date(sprint3.start)}, ${date(sprint3.end)})
  returning id into s3;

  insert into public.tickets (user_id, project_id, sprint_id, title, status, priority, estimated_hours, tags, position)
  values (v_uid, p_fix, s1, 'Maquetar home', 'done', 2, 8, '{web}', 1) returning id into t1;
  insert into public.tickets (user_id, project_id, sprint_id, title, status, priority, estimated_hours, tags, position)
  values (v_uid, p_fix, s1, 'Sistema de diseño (colores y tipografía)', 'done', 3, 6, '{diseño}', 2) returning id into t2;
  insert into public.tickets (user_id, project_id, sprint_id, title, status, priority, estimated_hours, tags, position)
  values (v_uid, p_fix, s2, 'Listado de productos con filtros', 'done', 1, 12, '{web,catalogo}', 1) returning id into t3;
  insert into public.tickets (user_id, project_id, sprint_id, title, status, priority, estimated_hours, tags, position, due_date)
  values (v_uid, p_fix, s3, 'Carrito de compras', 'in_progress', 1, 10, '{web,checkout}', 1, ${date(addDays(today, 3))})
  returning id into t4;
  insert into public.tickets (user_id, project_id, sprint_id, title, status, priority, estimated_hours, tags, position)
  values (v_uid, p_fix, s3, 'Integración con pasarela de pagos', 'review', 1, 8, '{checkout}', 2) returning id into t5;
  insert into public.tickets (user_id, project_id, sprint_id, title, status, priority, estimated_hours, tags, position, due_date)
  values
    (v_uid, p_fix, s3, 'Página de confirmación de pedido', 'todo', 2, 4, '{checkout}', 3, ${date(addDays(today, 5))}),
    (v_uid, p_fix, s3, 'Correo transaccional de compra', 'todo', 3, 3, '{correo}', 4, null),
    (v_uid, p_fix, null, 'SEO básico (metadatos y sitemap)', 'backlog', 3, 4, '{seo}', 1, null),
    (v_uid, p_fix, null, 'Optimizar imágenes del catálogo', 'backlog', 4, 2, '{rendimiento}', 2, null),
    (v_uid, p_fix, null, 'Ticket vencido de prueba', 'todo', 1, 1, '{}', 3, ${date(addDays(today, -2))});

  insert into public.time_entries (user_id, ticket_id, started_at, ended_at, hours, note) values
    (v_uid, t1, ${ts(addDays(sprint1.start, 1), 9)}, ${ts(addDays(sprint1.start, 1), 16)}, 7, 'Maquetación inicial'),
    (v_uid, t2, ${ts(addDays(sprint1.start, 3), 9)}, ${ts(addDays(sprint1.start, 3), 14)}, 5, null),
    (v_uid, t3, ${ts(addDays(sprint2.start, 2), 8)}, ${ts(addDays(sprint2.start, 2), 15)}, 7, 'Filtros por categoría'),
    (v_uid, t3, ${ts(addDays(sprint2.start, 3), 8)}, ${ts(addDays(sprint2.start, 3), 13)}, 5, 'Paginación'),
    (v_uid, t4, ${ts(addDays(today, -2), 9)}, ${ts(addDays(today, -2), 13)}, 4, null),
    (v_uid, t5, ${ts(addDays(today, -1), 14)}, ${ts(addDays(today, -1), 17)}, 3, 'Sandbox de pagos');

  insert into public.meeting_notes (user_id, project_id, title, meeting_date, source, content_md, attendees)
  values (v_uid, p_fix, '${DEMO_TAG} Revisión de avance con el cliente', ${date(addDays(today, -3))}, 'manual',
          E'## Resumen\\n- El cliente aprobó el catálogo.\\n- Pide ver el checkout la próxima semana.\\n\\n## Tareas\\n- [ ] Enviar enlace de staging\\n- [ ] Revisar textos legales',
          '{Cliente Demo,Guillermo}')
  returning id into n1;

  insert into public.note_action_items (user_id, note_id, text, position, status, ticket_id) values
    (v_uid, n1, 'Enviar enlace de staging', 0, 'pending', null),
    (v_uid, n1, 'Revisar textos legales', 1, 'pending', null),
    (v_uid, n1, 'Integración con pasarela de pagos', 2, 'converted', t5);

  insert into public.tasks (user_id, title, kind, status, priority, due_date, planned_on, waiting_on, project_id, tags) values
    (v_uid, '${DEMO_TAG} Preparar demo del checkout', 'todo', 'open', 1, ${date(addDays(today, 2))}, ${date(today)}, null, p_fix, '{demo}'),
    (v_uid, '${DEMO_TAG} Esperar logos en alta del cliente', 'follow_up', 'waiting', 2, ${date(addDays(today, 1))}, null, 'Cliente Demo', p_fix, '{demo}'),
    (v_uid, '${DEMO_TAG} Tarea vencida de prueba', 'todo', 'open', 2, ${date(addDays(today, -3))}, null, null, p_fix, '{demo}'),
    (v_uid, '${DEMO_TAG} Revisar facturas del mes', 'todo', 'open', 3, ${date(addDays(today, 6))}, null, null, null, '{demo}');

  -- 5) Proyecto entregado, en soporte -------------------------------------------
  insert into public.projects (user_id, name, client, code_prefix, color, billing_type, fixed_amount_cop,
                               estimated_total_hours, start_date, end_date, support_days)
  values (v_uid, '${DEMO_TAG} En soporte', 'Clínica Demo', 'DMSOP', '#ef4444', 'fixed', 12000000,
          100, ${date(sopStart)}, ${date(sopDelivered)}, 14)
  returning id into p_sop;

  insert into public.tickets (user_id, project_id, title, status, priority, estimated_hours) values
    (v_uid, p_sop, 'Landing de servicios', 'done', 2, 10),
    (v_uid, p_sop, 'Formulario de citas', 'done', 1, 12);

  -- Entrega (como deliverProject): fase soporte, pago final y sprint de soporte.
  update public.projects
     set delivered_at = ${date(sopDelivered)}, phase = 'support'
   where id = p_sop;

  insert into public.payments (user_id, project_id, kind, amount_cop, status, due_date, paid_at) values
    (v_uid, p_sop, 'advance', 6000000, 'received', ${date(sopStart)}, ${date(sopStart)}),
    (v_uid, p_sop, 'final', 6000000, 'expected', ${date(sopDelivered)}, null);

  insert into public.sprints (user_id, project_id, name, start_date, end_date, is_support)
  values (v_uid, p_sop, 'Soporte post-entrega', ${date(sopDelivered)}, ${date(addDays(sopDelivered, 14))}, true)
  returning id into s_sup;

  -- Creados después de la entrega: el trigger los vuelve "soporte" no facturable.
  insert into public.tickets (user_id, project_id, sprint_id, title, status, priority, estimated_hours)
  values (v_uid, p_sop, s_sup, 'Corregir envío de correo de confirmación', 'in_progress', 1, 2)
  returning id into t_sop;
  insert into public.tickets (user_id, project_id, sprint_id, title, status, priority, estimated_hours)
  values (v_uid, p_sop, s_sup, 'Cambiar foto del equipo', 'todo', 3, 1);

  insert into public.time_entries (user_id, ticket_id, started_at, ended_at, hours) values
    (v_uid, t_sop, ${ts(addDays(today, -1), 10)}, ${ts(addDays(today, -1), 11)}, 1);

  -- Tareas recurrentes de hoy (lo mismo que hace pg_cron cada mañana).
  perform private.generate_recurring_tasks(v_uid, ${date(today)});
end
$seed$;

commit;
`;
}

/**
 * Retira los datos de prueba (soft delete). Libera los prefijos y códigos de
 * ticket (sus índices únicos no excluyen borrados) para poder volver a sembrar.
 */
export function buildDemoResetSql({ email }: { email: string }): string {
  return `-- Retira los datos ${DEMO_TAG} de ${email} (soft delete).
begin;

do $reset$
declare
  v_uid uuid;
  v_projects uuid[];
  v_now timestamptz := now();
  v_project record;
  v_prefix text;
begin
  ${userLookup(email)}

  select coalesce(array_agg(id), '{}') into v_projects
    from public.projects
   where user_id = v_uid and name like ${lit(`${DEMO_TAG}%`)} and deleted_at is null;

  update public.time_entries set deleted_at = v_now
   where user_id = v_uid and deleted_at is null
     and ticket_id in (select id from public.tickets where project_id = any (v_projects));

  update public.note_action_items set deleted_at = v_now
   where user_id = v_uid and deleted_at is null
     and note_id in (select id from public.meeting_notes where project_id = any (v_projects)
                                                      or title like ${lit(`${DEMO_TAG}%`)});

  update public.meeting_notes set deleted_at = v_now
   where user_id = v_uid and deleted_at is null
     and (project_id = any (v_projects) or title like ${lit(`${DEMO_TAG}%`)});

  update public.recurring_tasks set deleted_at = v_now, active = false
   where user_id = v_uid and deleted_at is null
     and (project_id = any (v_projects) or title like ${lit(`${DEMO_TAG}%`)});

  update public.tasks set deleted_at = v_now
   where user_id = v_uid and deleted_at is null
     and (project_id = any (v_projects) or title like ${lit(`${DEMO_TAG}%`)});

  update public.payments set deleted_at = v_now
   where user_id = v_uid and deleted_at is null and project_id = any (v_projects);

  update public.sprints set deleted_at = v_now
   where user_id = v_uid and deleted_at is null and project_id = any (v_projects);

  for v_project in
    select id from public.projects where id = any (v_projects)
  loop
    v_prefix := 'Z' || upper(substr(md5(random()::text || v_project.id::text), 1, 9));
    update public.tickets
       set deleted_at = coalesce(deleted_at, v_now), code = v_prefix || '-' || number
     where project_id = v_project.id;
    update public.projects
       set deleted_at = v_now, code_prefix = v_prefix
     where id = v_project.id;
  end loop;

  raise notice 'Proyectos ${DEMO_TAG} retirados: %', coalesce(array_length(v_projects, 1), 0);
end
$reset$;

commit;
`;
}
