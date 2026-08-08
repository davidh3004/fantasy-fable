"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/config";
import { getPasswordChangeContext } from "@/lib/auth/password-change";

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
