"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { resetPassword } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthAlert } from "./auth-alert";

export function ResetForm() {
  const t = useTranslations("auth.reset");
  const tErrors = useTranslations("auth.errors");
  const [state, formAction, isPending] = useActionState(resetPassword, {});

  return (
    <div className="flex flex-col gap-5">
      {state.error && <AuthAlert variant="error" message={tErrors(state.error)} />}
      {state.success && <AuthAlert variant="success" message={t("sent")} />}

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="h-11"
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

      <Link
        href="/login"
        className="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>
    </div>
  );
}
