import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";

import { publicEnv, serverEnv } from "@/lib/env";

// Llamado a diario por el cron de Vercel (vercel.json) para que Supabase Free
// no pause el proyecto por inactividad. Vercel envía `Authorization: Bearer $CRON_SECRET`.
function isAuthorized(header: string | null) {
  const expected = Buffer.from(`Bearer ${serverEnv().CRON_SECRET}`);
  const received = Buffer.from(header ?? "");
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const supabase = createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  const { data, error } = await supabase.rpc("ping");

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 503 });
  }
  return Response.json({ ok: true, at: data });
}
