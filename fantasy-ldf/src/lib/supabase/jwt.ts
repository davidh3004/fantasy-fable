import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

// Trailing slashes are easy to leave in the env var and would produce a
// double slash in both URLs below.
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(
  /\/+$/,
  ""
);

/**
 * Module-level JWKS: fetched once per server process and cached by jose
 * (with automatic refetch on unknown key ids). This is what makes local
 * JWT verification effectively free — no per-request network calls.
 */
const jwks = createRemoteJWKSet(
  new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
);

/**
 * A signature check alone only says "some key in that JWKS signed this". These
 * two claims say *what* was signed: a token minted for a different Supabase
 * project or for a different audience is now rejected instead of being taken
 * for one of our sessions.
 *
 * Both values were read off a real access token from this project rather than
 * assumed: iss is the project URL with /auth/v1, aud is "authenticated".
 */
const ISSUER = `${SUPABASE_URL}/auth/v1`;
const AUDIENCE = "authenticated";

export type VerifiedClaims = JWTPayload & {
  sub: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

/** Verifies a Supabase access token locally. Null when invalid/expired. */
export async function verifyAccessToken(
  token: string
): Promise<VerifiedClaims | null> {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    // End-user sessions carry role "authenticated". Anything else — a
    // service-role token above all — must never be mistaken for a signed-in
    // visitor, and `aud` does not separate them on its own.
    if (payload.role !== AUDIENCE) return null;
    if (typeof payload.sub !== "string" || !payload.sub) return null;

    return payload as VerifiedClaims;
  } catch {
    return null;
  }
}
