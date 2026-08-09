import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { verifyAccessToken, type VerifiedClaims } from "@/lib/supabase/jwt";

/**
 * How long a recovery counts for. The `amr` timestamp is set when the session
 * is minted and survives token refreshes, so without a window a session that
 * once came from a recovery link would keep the exemption for as long as it
 * stays alive.
 */
const RECOVERY_WINDOW_SECONDS = 30 * 60;

type AmrEntry = { method?: unknown; timestamp?: unknown };

/**
 * Did this session come from a password-recovery email, recently?
 *
 * This is the one case where the current password cannot be demanded — the
 * user is on that page precisely because they don't know it. Supabase records
 * the fact in the `amr` claim of the access token, which is signed by the auth
 * server: whoever merely holds a stolen session cookie cannot forge it. A
 * marker cookie set by our own callback route would not do, since the person
 * holding the session can set cookies in their own browser at will.
 */
export function isFreshRecovery(
  claims: VerifiedClaims | null,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): boolean {
  const amr = claims?.amr;
  if (!Array.isArray(amr)) return false;

  return amr.some((entry: AmrEntry) => {
    if (entry?.method !== "recovery") return false;
    const timestamp = entry.timestamp;
    if (typeof timestamp !== "number") return false;
    return nowSeconds - timestamp <= RECOVERY_WINDOW_SECONDS;
  });
}

export type PasswordChangeContext = {
  user: User;
  /** The account can sign in with a password, so there is one to re-check. */
  hasPassword: boolean;
  viaRecovery: boolean;
  needsCurrentPassword: boolean;
};

/**
 * Who is changing their password, and may they do it without proving they know
 * the old one. Read by the page to decide whether to render the field, and
 * again by the action to decide whether to enforce it — the action never
 * trusts the form for this.
 */
export async function getPasswordChangeContext(): Promise<PasswordChangeContext | null> {
  const supabase = await createClient();

  // getUser() revalidates against the Auth server; a revoked session fails here.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const claims = session ? await verifyAccessToken(session.access_token) : null;

  const viaRecovery = isFreshRecovery(claims);
  // Google-only accounts have no password yet; there is nothing to re-check,
  // and demanding one would lock them out of ever setting it.
  const hasPassword = (user.identities ?? []).some(
    (identity) => identity.provider === "email"
  );

  return {
    user,
    hasPassword,
    viaRecovery,
    needsCurrentPassword: hasPassword && !viaRecovery,
  };
}
