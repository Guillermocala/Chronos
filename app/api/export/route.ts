import { isAllowedEmail } from "@/lib/env";
import { todayCO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

// Descarga de todos mis datos (JSON) con la sesión del usuario: RLS limita a lo propio.
// Incluye filas con soft delete, igual que el backup.
const TABLES = [
  "projects",
  "payments",
  "sprints",
  "tickets",
  "time_entries",
  "tasks",
  "meeting_notes",
  "note_action_items",
] as const;

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims || !isAllowedEmail(data.claims.email as string | undefined)) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const result: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    const { data: rows, error } = await supabase.from(table).select("*").order("created_at");
    if (error) return Response.json({ error: `No se pudo leer ${table}.` }, { status: 500 });
    result[table] = rows;
  }

  const today = todayCO();
  return new Response(JSON.stringify({ exported_at: new Date().toISOString(), ...result }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="chronos-${today}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
