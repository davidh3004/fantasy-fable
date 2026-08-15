/**
 * Cookie consent, kept deliberately small.
 *
 * The app has no advertising and no third-party trackers. The only thing that
 * needs asking about is error reporting, which sends a technical report — and
 * with it an IP address — to a processor outside the country. So the choice is
 * binary: essential only, or essential plus error reports.
 *
 * The value is readable from the browser on purpose. The client-side error
 * reporter has to decide whether to start up before any React code runs, so it
 * cannot wait for a server round trip; that means no httpOnly here. Nothing
 * secret is stored in it — it holds one of two words.
 */
export const CONSENT_COOKIE = "ldf-consent";

export type ConsentChoice = "essential" | "all";

export function isConsentChoice(value: unknown): value is ConsentChoice {
  return value === "essential" || value === "all";
}

/** A year: long enough not to nag, short enough to be asked again eventually. */
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Reads the choice in the browser. Returns null when nothing was chosen yet. */
export function readConsentCookie(): ConsentChoice | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE}=([^;]*)`)
  );
  const value = match?.[1];
  return isConsentChoice(value) ? value : null;
}
