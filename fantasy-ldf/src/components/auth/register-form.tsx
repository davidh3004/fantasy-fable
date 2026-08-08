"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { register } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthAlert } from "./auth-alert";
import { GoogleButton } from "./google-button";
import { OrSeparator } from "./or-separator";
import { PasswordInput } from "./password-input";

export function RegisterForm() {
  const t = useTranslations("auth.register");
  const tErrors = useTranslations("auth.errors");
  const [state, formAction, isPending] = useActionState(register, {});

  if (state.success) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/15">
          <MailCheck className="size-7 text-primary" aria-hidden />
        </div>
        <p role="status" className="text-balance">
          {t("checkEmail")}
        </p>
        <Link href="/login" className="font-medium text-primary transition-colors hover:text-cta">
          {t("loginLink")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {state.error && <AuthAlert variant="error" message={tErrors(state.error)} />}

      <GoogleButton label={t("google")} />
      <OrSeparator label={t("orEmail")} />

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="displayName">{t("displayName")}</Label>
          <Input
            id="displayName"
            name="displayName"
            autoComplete="nickname"
            maxLength={30}
            required
            defaultValue={state.values?.displayName}
            className="h-11"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.values?.email}
            className="h-11"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t("password")}</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            required
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="text-xs text-muted-foreground">
            {t("passwordHint")}
          </p>
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

      <p className="text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link
          href="/login"
          className="font-medium text-primary transition-colors hover:text-cta"
        >
          {t("loginLink")}
        </Link>
      </p>
    </div>
  );
}
