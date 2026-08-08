"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { updatePassword } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuthAlert } from "./auth-alert";
import { PasswordInput } from "./password-input";

export function UpdatePasswordForm({
  needsCurrentPassword,
}: {
  /** False in the recovery flow, where the old password is what's forgotten. */
  needsCurrentPassword: boolean;
}) {
  const t = useTranslations("auth.update");
  const tErrors = useTranslations("auth.errors");
  const [state, formAction, isPending] = useActionState(updatePassword, {});

  return (
    <div className="flex flex-col gap-5">
      {state.error && <AuthAlert variant="error" message={tErrors(state.error)} />}

      <form action={formAction} className="flex flex-col gap-4">
        {needsCurrentPassword && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="currentPassword">{t("currentPassword")}</Label>
            <PasswordInput
              id="currentPassword"
              name="currentPassword"
              autoComplete="current-password"
              required
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t("password")}</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="mt-2 h-11 w-full cursor-pointer font-semibold"
        >
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {t("submit")}
        </Button>
      </form>
    </div>
  );
}
