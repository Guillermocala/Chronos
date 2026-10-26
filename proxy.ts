import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

// Chequeo optimista y refresco de sesión. La verificación real se repite en
// el layout protegido y en cada Server Action.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Todo excepto estáticos, imágenes, el endpoint de cron (usa su propio secreto)
    // lo público de la PWA (manifest, service worker, íconos y página sin conexión)
    // y las imágenes de vista previa al compartir (opengraph-image, twitter-image).
    "/((?!_next/static|_next/image|favicon.ico|api/health|manifest.webmanifest|sw.js|icons/|icon|apple-icon|offline|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
