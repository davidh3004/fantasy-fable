"use client";

import { Shirt, Trophy, Wallet, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/game/format";
import type { SquadSettings } from "@/lib/game/squad";

const CARDS = [
  { key: "squad", Icon: Wallet },
  { key: "lineup", Icon: Shirt },
  { key: "points", Icon: Zap },
  { key: "compete", Icon: Trophy },
] as const;

type WelcomeStepProps = {
  settings: SquadSettings;
  onContinue: () => void;
};

export function WelcomeStep({ settings, onContinue }: WelcomeStepProps) {
  const t = useTranslations("onboarding.welcome");

  const cardParams = {
    count: settings.squadSize,
    budget: formatMoney(settings.budget),
    max: settings.maxPerClub,
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h2 className="font-heading text-2xl">{t("title")}</h2>
      <p className="mt-1.5 text-muted-foreground">{t("intro")}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {CARDS.map(({ key, Icon }, index) => (
          <div
            key={key}
            className="flex gap-3.5 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15">
              <Icon className="size-5 text-primary" aria-hidden />
            </div>
            <div>
              <p className="flex items-center gap-2 font-semibold">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {index + 1}.
                </span>
                {t(`cards.${key}.title`)}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {t(`cards.${key}.body`, cardParams)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        onClick={onContinue}
        className="mt-8 h-11 w-full cursor-pointer font-semibold sm:w-auto sm:px-10"
      >
        {t("start")}
      </Button>
    </div>
  );
}
