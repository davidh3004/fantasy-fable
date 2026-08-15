import { createClient } from "./server";
import { verifyAccessToken } from "./jwt";

export type SessionUser = {
  id: string;
  email: string | null;
  displayName: string;
};

/**
 * Fast session lookup for reads: getSession() only reads the auth cookie
 * (refreshing over the network solely when the token has expired), and the
 * JWT is then verified locally against the process-cached JWKS.
 *
 * Use this in layouts/pages. Keep getUser() in server actions that write —
 * it revalidates against the Auth server.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const claims = await verifyAccessToken(session.access_token);
  if (!claims) return null;

  const meta = claims.user_metadata ?? {};
  const email = claims.email ?? null;

  return {
    id: claims.sub,
    email,
    /**
     * The email fallback is safe *here* and only here: this name is rendered
     * back to the person it belongs to — the greeting in the shell and their
     * own settings screen. The public name is `profiles.display_name`, which
     * is written at onboarding and deliberately never derived from an address.
     */
    displayName:
      (meta.display_name as string | undefined) ??
      (meta.name as string | undefined) ??
      email?.split("@")[0] ??
      "",
  };
}
