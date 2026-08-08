"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

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

async function getOrigin() {
  return (await headers()).get("origin") ?? "";
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
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${await getOrigin()}/auth/callback`,
    },
  });

  if (error) return { error: mapAuthError(error.code), values };

  // Supabase returns a user with no identities when the email is already registered.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "user_already_exists", values };
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
    redirectTo: `${await getOrigin()}/auth/callback?next=/update-password`,
  });

  if (error) return { error: mapAuthError(error.code) };

  return { success: "sent" };
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!password) return { error: "missing_fields" };
  if (password.length < 8) return { error: "weak_password" };
  if (password !== confirmPassword) return { error: "passwords_mismatch" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) return { error: mapAuthError(error.code) };

  redirect("/home");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
