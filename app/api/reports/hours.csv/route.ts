import { todayCO } from "@/lib/dates";
import { listReportEntries } from "@/lib/data/reports";
import { csvResponse, toCsv } from "@/lib/reports/csv";
import { isAuthorizedRequest, readRangeParams } from "@/lib/reports/csv-auth";
import { dateInBogota } from "@/lib/reports/hours";
import { TICKET_KIND_LABELS } from "@/lib/tickets/schema";

// Horas registradas en un rango: base para la cuenta de cobro.
// /api/reports/hours.csv?from=AAAA-MM-DD&to=AAAA-MM-DD&project=<uuid>
export async function GET(request: Request) {
  if (!(await isAuthorizedRequest())) return Response.json({ error: "No autorizado." }, { status: 401 });
  const range = readRangeParams(request.url, todayCO());
  if (!range) return Response.json({ error: "Parámetros inválidos." }, { status: 400 });

  const entries = await listReportEntries(range.from, range.to, range.project);
  const csv = toCsv(entries, [
    { header: "Fecha", value: (e) => dateInBogota(e.started_at) },
    { header: "Proyecto", value: (e) => `${e.ticket.project.code_prefix} · ${e.ticket.project.name}` },
    { header: "Ticket", value: (e) => e.ticket.code },
    { header: "Título", value: (e) => e.ticket.title },
    { header: "Tipo", value: (e) => TICKET_KIND_LABELS[e.ticket.kind] },
    { header: "Horas", value: (e) => (e.hours === null ? null : Number(e.hours)) },
    { header: "Nota", value: (e) => e.note },
  ]);
  return csvResponse(csv, `chronos-horas-${range.from}_${range.to}.csv`);
}
