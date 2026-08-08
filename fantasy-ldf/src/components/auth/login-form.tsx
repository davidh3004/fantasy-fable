"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { login } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthAlert } from "./auth-alert";
import { GoogleButton } from "./google-button";
import { OrSeparator } from "./or-separator";
import { PasswordInput } from "./password-input";

export function LoginForm({ urlError }: { urlError?: string }) {
  const t = useTranslations("auth.login");
  const tErrors = useTranslations("auth.errors");
  const [state, formAction, isPending] = useActionState(login, {});

  const error = state.error ?? urlError;

  return (
    <div className="flex flex-col gap-5">
      {error && <AuthAlert variant="error" message={tErrors(error)} />}

      <GoogleButton label={t("google")} />
      <OrSeparator label={t("orEmail")} />

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            /* Re-seeded from the action's state: React 19 resets the form once
               the action resolves, which otherwise wipes what was typed. */
            defaultValue={state.values?.email}
            className="h-11"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("password")}</Label>
            <Link
              href="/reset-password"
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              {t("forgot")}
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
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
        {t("noAccount")}{" "}
        <Link
          href="/register"
          className="font-medium text-primary transition-colors hover:text-cta"
        >
          {t("registerLink")}
        </Link>
      </p>
    </div>
  );
}
