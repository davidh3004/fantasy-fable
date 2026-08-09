import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/supabase/jwt";

/**
 * The Content-Security-Policy lives here rather than in next.config.ts because
 * it carries a per-request nonce, and only a request-time hook can mint one.
 *
 * It is enforced, not Report-Only: the previous header logged violations and
 * blocked nothing, which is no defence at all. script-src carries no
 * 'unsafe-inline' — Next stamps this nonce onto every script tag it emits, so
 * a <script> smuggled into the page through injected content simply does not
 * run. That is the protection an XSS-stolen session cookie depended on.
 *
 * style-src keeps 'unsafe-inline' on purpose: the app sets style attributes
 * from data (club colours, progress bar widths), and CSP nonces cannot cover
 * style *attributes* — only <style> elements. Removing it would mean hashing
 * values that change per row. Injected CSS is a far smaller problem than
 * injected script, so this is where the line is drawn.
 */
/**
 * Sentry's ingest host, taken from the DSN rather than guessed.
 *
 * A wildcard is the wrong tool here: CSP matches `*.` against a literal
 * suffix, so `*.ingest.sentry.io` does not cover a regional host like
 * `oNNN.ingest.us.sentry.io` — which is exactly how the browser came to block
 * every event. The DSN already names the host, so use it, and it keeps working
 * if the project or region ever changes.
 */
function sentryIngestOrigin(): string | null {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return null;
  try {
    return new URL(dsn).origin;
  } catch {
    return null;
  }
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const sentry = sentryIngestOrigin();
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    // 'strict-dynamic' lets the nonced framework bundle load its own chunks.
    // React needs eval in development only; production has no eval.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      isDev ? " 'unsafe-eval'" : ""
    }`,
    // Supabase for auth/data; Sentry's ingest host when a DSN is configured.
    [
      "connect-src 'self'",
      "https://*.supabase.co",
      "wss://*.supabase.co",
      ...(sentry ? [sentry] : []),
    ].join(" "),
  ].join("; ");
}

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
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = btoa(String.fromCharCode(...bytes));
  const csp = buildCsp(nonce);

  /**
   * Next reads the nonce off the *request* headers to stamp its script tags,
   * so both headers have to be forwarded inward. Rebuilt each time rather than
   * captured once, because the Supabase client mutates request cookies before
   * the response is recreated below and those updates must survive.
   */
  const nextWithCsp = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    const res = NextResponse.next({ request: { headers } });
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  let response = nextWithCsp();

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
          response = nextWithCsp();
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
    redirect.headers.set("Content-Security-Policy", csp);
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
