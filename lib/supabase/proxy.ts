import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isAllowedEmail, publicEnv } from "@/lib/env";

const PUBLIC_PATHS = ["/login"];

// Copia cookies y cabeceras de caché del response de Supabase a una redirección,
// para no perder el token refrescado.
function redirectWithSession(
  request: NextRequest,
  supabaseResponse: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  supabaseResponse.cookies
    .getAll()
    .forEach((cookie) => redirect.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = supabaseResponse.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  // No poner código entre createServerClient y getClaims: getClaims refresca el token.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (claims && !isAllowedEmail(claims.email as string | undefined)) {
    await supabase.auth.signOut();
    return redirectWithSession(request, supabaseResponse, "/login");
  }

  if (!claims && !isPublic) {
    return redirectWithSession(request, supabaseResponse, "/login");
  }

  if (claims && isPublic) {
    return redirectWithSession(request, supabaseResponse, "/dashboard");
  }

  return supabaseResponse;
}
