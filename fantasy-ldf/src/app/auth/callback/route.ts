import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";

// Handles the OAuth (PKCE) code exchange — Google sign-in lands here.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";
  const safeNext = next.startsWith("/") ? next : "/home";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
    // Surface the real reason (PKCE verifier missing, expired code, etc.)
    // instead of swallowing it behind the generic error page.
    Sentry.captureException(error, { tags: { area: "auth-callback" } });
    console.error("OAuth/code exchange failed:", error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=confirm`);
}
