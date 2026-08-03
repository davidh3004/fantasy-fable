import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/supabase/jwt";

// Paths reachable without a session. Everything else requires auth.
// (/api/sentry-check is token-gated in the handler; public so it's curl-able.)
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/reset-password",
  "/auth",
  "/api/sentry-check",
];
// Authed users get bounced away from these (update-password stays reachable
// because the recovery flow arrives with a session).
const AUTH_ONLY_BOUNCE = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getSession() reads the auth cookie locally and only goes to the network
  // to refresh an expired token; the JWT itself is then verified against the
  // process-cached JWKS. No per-request Auth server round-trip.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session
    ? await verifyAccessToken(session.access_token)
    : null;

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/" || PUBLIC_PATHS.some((p) => path.startsWith(p));

  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Preserve any refreshed session cookies on the redirect response.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user && !isPublic) {
    return redirectTo("/login");
  }

  if (user && AUTH_ONLY_BOUNCE.some((p) => path.startsWith(p))) {
    return redirectTo("/home");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
