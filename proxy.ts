import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

// Chequeo optimista y refresco de sesión. La verificación real se repite en
// el layout protegido y en cada Server Action.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Todo excepto estáticos, imágenes y el endpoint de cron (usa su propio secreto).
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
