"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/config";
import { getPasswordChangeContext } from "@/lib/auth/password-change";
import { consumeRateLimit, limitKey } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";

/**
 * Supabase throttles its own auth endpoints, but only it knows those numbers
 * and only it decides when they apply. These are ours, in front: every attempt
 * here costs a bcrypt or an email, and both are worth spending deliberately.
 *
 * Two keys where it matters. Per IP stops one machine sweeping many addresses;
 * per address stops a patient attacker rotating IPs at one account. The
 * per-address limits are kept loose enough that using them to lock a rival out
 * of their own account is a poor weapon.
 */
const LIMITS = {
  loginIp: { max: 10, window: 5 * 60 },
  loginEmail: { max: 5, window: 15 * 60 },
  registerIp: { max: 5, window: 60 * 60 },
  resetEmail: { max: 3, window: 60 * 60 },
  resetIp: { max: 10, window: 60 * 60 },
  updatePasswordUser: { max: 5, window: 60 * 60 },
} as const;

/**
 * Reports a trip as the same error Supabase's own throttle uses, so the user
 * sees one message however the brake was applied — and so this never doubles
 * as a signal about whether an address exists.
 */
const RATE_LIMITED: AuthState = { error: "over_request_rate_limit" };

async function overLimit(
  scope: string,
  value: string | null,
  { max, window }: { max: number; window: number }
): Promise<boolean> {
  if (!value) return false; // Unidentifiable client — see clientIp().
  const { allowed } = await consumeRateLimit(limitKey(scope, value), max, window);
  return !allowed;
}

export type AuthState = {
  error?: string;
  success?: string;
  /**
   * What the user typed, echoed back so a failed submit doesn't wipe the form.
   * React 19 resets an uncontrolled form once its action resolves, so the
   * fields have to be re-seeded from state as defaultValues.
   *
   * Passwords are deliberately absent: they'd be serialized into the payload
   * sent to the browser, and clearing them on a failed sign-in is the norm.
   */
  values?: { email?: string; displayName?: string };
};

// Supabase auth error codes we translate; anything else falls back to "unknown".
const KNOWN_ERROR_CODES = new Set([
  "invalid_credentials",
  "email_not_confirmed",
  "user_already_exists",
  "weak_password",
  "over_request_rate_limit",
]);

function mapAuthError(code: string | undefined): string {
  return code && KNOWN_ERROR_CODES.has(code) ? code : "unknown";
}

export async function login(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "missing_fields", values: { email } };
  }

  // Counted before the password is checked, so guesses are what's limited.
  const ip = await clientIp();
  if (await overLimit("login:ip", ip, LIMITS.loginIp)) {
    return { ...RATE_LIMITED, values: { email } };
  }
  if (await overLimit("login:email", email, LIMITS.loginEmail)) {
    return { ...RATE_LIMITED, values: { email } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  // email_not_confirmed is kept distinct from invalid_credentials on purpose.
  // Checked against the auth server: a wrong password returns
  // invalid_credentials for an unknown address, a confirmed account and an
  // unconfirmed one alike — email_not_confirmed only ever comes back once the
  // password is already correct, so it tells an enumerator nothing they did
  // not have. Collapsing the two would stall genuinely unconfirmed users on
  // "wrong email or password" for no gain.
  if (error) return { error: mapAuthError(error.code), values: { email } };

  redirect("/home");
}

export async function register(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const values = { email, displayName };
  if (!displayName || !email || !password) {
    return { error: "missing_fields", values };
  }
  if (password.length < 8) return { error: "weak_password", values };
  if (password !== confirmPassword) {
    return { error: "passwords_mismatch", values };
  }

  // Per IP only: a per-address limit here would answer the very question the
  // neutral response above refuses to answer.
  if (await overLimit("register:ip", await clientIp(), LIMITS.registerIp)) {
    return { ...RATE_LIMITED, values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${SITE_URL}/auth/callback`,
    },
  });

  // Never disclose whether the address already has an account. Supabase hands
  // back a user with an empty identities array when the email is taken, and
  // reporting that turns this form into a membership oracle: anyone can test
  // addresses one at a time and learn who is registered here, which is the
  // raw material for targeted phishing.
  //
  // Both that marker and an explicit user_already_exists resolve to the same
  // neutral outcome as a genuine signup. The success copy covers both cases,
  // so someone who forgot they had an account is still pointed somewhere
  // useful rather than being told a comforting lie.
  if (error && error.code !== "user_already_exists") {
    return { error: mapAuthError(error.code), values };
  }

  return { success: "checkEmail" };
}

export async function resetPassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "missing_fields" };

  // Every call here sends mail. Today Supabase's own SMTP throttle is the
  // backstop; the day a real provider is connected, this is what stands
  // between an attacker and a bill plus a burnt sending domain.
  if (await overLimit("reset:ip", await clientIp(), LIMITS.resetIp)) {
    return RATE_LIMITED;
  }
  if (await overLimit("reset:email", email, LIMITS.resetEmail)) {
    return RATE_LIMITED;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/auth/callback?next=/update-password`,
  });

  if (error) return { error: mapAuthError(error.code) };

  return { success: "sent" };
}

/**
 * Changing a password requires proving you know the current one — otherwise a
 * stolen session cookie converts into permanent ownership of the account, and
 * the real owner cannot take it back. The exception is a recovery session,
 * where not knowing the password is the whole reason for being here.
 *
 * On success every other session is revoked, so a thief holding a copy of the
 * session elsewhere is thrown out by the same act that changes the password.
 */
export async function updatePassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const currentPassword = String(formData.get("currentPassword") ?? "");

  if (!password) return { error: "missing_fields" };
  if (password.length < 8) return { error: "weak_password" };
  if (password !== confirmPassword) return { error: "passwords_mismatch" };

  const context = await getPasswordChangeContext();
  if (!context) redirect("/login");

  // Re-authentication below spends a bcrypt per attempt, which makes this a
  // password oracle against the session holder's own account if left open.
  if (
    await overLimit(
      "updatepw:user",
      context.user.id,
      LIMITS.updatePasswordUser
    )
  ) {
    return RATE_LIMITED;
  }

  const supabase = await createClient();

  if (context.needsCurrentPassword) {
    if (!currentPassword) return { error: "current_password_required" };
    if (currentPassword === password) return { error: "password_unchanged" };

    const email = context.user.email;
    if (!email) return { error: "unknown" };

    // The only way to check a password with Supabase is to use it. On success
    // this mints an extra session, which the revocation below then clears.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (reauthError) {
      return {
        error:
          reauthError.code === "over_request_rate_limit"
            ? "over_request_rate_limit"
            : "current_password_wrong",
      };
    }
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) return { error: mapAuthError(error.code) };

  // Leaves this session signed in and drops every other one.
  await supabase.auth.signOut({ scope: "others" });

  redirect("/home");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
