import { todayCO } from "@/lib/dates";
import { listReportPayments } from "@/lib/data/reports";
import { PAYMENT_KIND_LABELS } from "@/lib/projects/labels";
import { csvResponse, toCsv } from "@/lib/reports/csv";
import { isAuthorizedRequest, readRangeParams } from "@/lib/reports/csv-auth";

// Pagos cuyo vencimiento o fecha de pago cae en el rango (sin fecha: se incluyen).
// /api/reports/payments.csv?from=AAAA-MM-DD&to=AAAA-MM-DD&project=<uuid>
export async function GET(request: Request) {
  if (!(await isAuthorizedRequest())) return Response.json({ error: "No autorizado." }, { status: 401 });
  const range = readRangeParams(request.url, todayCO());
  if (!range) return Response.json({ error: "Parámetros inválidos." }, { status: 400 });

  const inRange = (d: string | null) => d !== null && d >= range.from && d <= range.to;
  const payments = (await listReportPayments(range.project)).filter(
    (p) => inRange(p.due_date) || inRange(p.paid_at) || (p.due_date === null && p.paid_at === null),
  );
  const csv = toCsv(payments, [
    { header: "Proyecto", value: (p) => `${p.project.code_prefix} · ${p.project.name}` },
    { header: "Tipo", value: (p) => PAYMENT_KIND_LABELS[p.kind] },
    { header: "Monto (COP)", value: (p) => p.amount_cop },
    { header: "Estado", value: (p) => (p.status === "received" ? "Recibido" : "Pendiente") },
    { header: "Fecha esperada", value: (p) => p.due_date },
    { header: "Fecha de pago", value: (p) => p.paid_at },
    { header: "Nota", value: (p) => p.note },
  ]);
  return csvResponse(csv, `chronos-pagos-${range.from}_${range.to}.csv`);
}
