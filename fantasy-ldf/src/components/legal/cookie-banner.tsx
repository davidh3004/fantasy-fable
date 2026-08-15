"use client";

import { useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  type ConsentChoice,
} from "@/lib/consent";

/**
 * Shown until a choice is made, and never again after.
 *
 * Nothing optional runs before the visitor answers: the error reporter reads
 * this same cookie on start-up and stays off without it, so the banner is a
 * real gate rather than a notice pretending to be one. Both buttons are equally
 * easy to reach — a "reject" hidden behind a settings screen is not a free
 * choice, and it is the detail regulators look at first.
 */
export function CookieBanner({ initialChoice }: { initialChoice: ConsentChoice | null }) {
  const t = useTranslations("legal.cookies");
  const [choice, setChoice] = useState(initialChoice);

  if (choice) return null;

  function decide(next: ConsentChoice) {
    document.cookie = `${CONSENT_COOKIE}=${next}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${
      window.location.protocol === "https:" ? "; Secure" : ""
    }`;
    setChoice(next);
    // Accepting has to reload: the reporter decides whether to start when the
    // page loads, so it is already off for this one. Declining changes
    // nothing that is running, so it doesn't.
    if (next === "all") window.location.reload();
  }

  return (
    <div
      role="dialog"
      aria-label={t("title")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 p-4 backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 sm:flex-row sm:items-center">
        <Cookie className="hidden size-5 shrink-0 text-primary sm:block" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t("title")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("body")}{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-2 hover:text-primary"
            >
              {t("readMore")}
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            onClick={() => decide("essential")}
            className="h-10 flex-1 cursor-pointer sm:flex-none"
          >
            {t("essential")}
          </Button>
          <Button
            onClick={() => decide("all")}
            className="h-10 flex-1 cursor-pointer sm:flex-none"
          >
            {t("acceptAll")}
          </Button>
        </div>
      </div>
    </div>
  );
}
