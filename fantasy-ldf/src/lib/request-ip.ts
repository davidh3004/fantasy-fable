import { headers } from "next/headers";

/**
 * The caller's IP, or null when it can't be determined.
 *
 * Null rather than a placeholder on purpose: a shared "unknown" bucket would
 * put every anonymous visitor on one counter, so the first burst would lock
 * out the whole internet. Callers skip IP limiting instead — failing open on
 * an unidentifiable client beats locking out an identifiable one.
 *
 * On Vercel the edge sets x-forwarded-for and the client's address is its
 * first entry; anything a client appends lands after it.
 */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = h.get("x-real-ip")?.trim();
  return forwarded || real || null;
}

