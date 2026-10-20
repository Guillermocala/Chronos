import { getProjectHours, getSprint, listSprintTickets } from "@/lib/data/tickets";
import { csvResponse, toCsv } from "@/lib/reports/csv";
import { isAuthorizedRequest } from "@/lib/reports/csv-auth";
import { TICKET_KIND_LABELS, TICKET_STATUS_LABELS } from "@/lib/tickets/schema";
import { ticketValue } from "@/lib/valuation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Tickets de un sprint con horas y valor. /api/reports/sprint.csv?sprint=<uuid>
export async function GET(request: Request) {
  if (!(await isAuthorizedRequest())) return Response.json({ error: "No autorizado." }, { status: 401 });
  const sprintId = new URL(request.url).searchParams.get("sprint") ?? "";
  if (!UUID.test(sprintId)) return Response.json({ error: "Parámetros inválidos." }, { status: 400 });

  const sprint = await getSprint(sprintId);
  if (!sprint) return Response.json({ error: "No existe el sprint." }, { status: 404 });
  const [tickets, hours] = await Promise.all([listSprintTickets(sprintId), getProjectHours(sprint.project_id)]);

  const csv = toCsv(tickets, [
    { header: "Ticket", value: (t) => t.code },
    { header: "Título", value: (t) => t.title },
    { header: "Estado", value: (t) => TICKET_STATUS_LABELS[t.status] },
    { header: "Tipo", value: (t) => TICKET_KIND_LABELS[t.kind] },
    { header: "Horas estimadas", value: (t) => (t.estimated_hours === null ? null : Number(t.estimated_hours)) },
    { header: "Horas registradas", value: (t) => t.logged_hours },
    { header: "Valor (COP)", value: (t) => ticketValue(sprint.project, t, hours.scope_estimated).value },
  ]);
  const slug = `${sprint.project.code_prefix}-${sprint.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return csvResponse(csv, `chronos-sprint-${slug}.csv`);
}
