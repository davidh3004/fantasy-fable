import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

/**
 * Module-level JWKS: fetched once per server process and cached by jose
 * (with automatic refetch on unknown key ids). This is what makes local
 * JWT verification effectively free — no per-request network calls.
 */
const jwks = createRemoteJWKSet(
  new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`
  )
);

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
    const { payload } = await jwtVerify(token, jwks);
    return payload as VerifiedClaims;
  } catch {
    return null;
  }
}
