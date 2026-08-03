import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

/**
 * Diagnostic route: fires a real event through the deployed Sentry SDK so you
 * can verify end-to-end delivery. Disabled by default — returns 404 unless
 * SENTRY_CHECK_TOKEN is set AND the ?token= query param matches it. Safe to
 * leave in production because the token gates access.
 *
 *   GET /api/sentry-check?token=<SENTRY_CHECK_TOKEN>
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const expected = process.env.SENTRY_CHECK_TOKEN;

  if (!expected || token !== expected) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const eventId = Sentry.captureException(
    new Error("Sentry end-to-end check — safe to ignore/resolve.")
  );
  await Sentry.flush(2000);

  return NextResponse.json({ ok: true, eventId });
}
