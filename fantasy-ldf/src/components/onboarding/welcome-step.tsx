"use client";

import { useRef, useState } from "react";
import { Shirt, Trophy, Wallet, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/game/format";
import { cn } from "@/lib/utils";
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
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const cardParams = {
    count: settings.squadSize,
    budget: formatMoney(settings.budget),
    max: settings.maxPerClub,
  };

  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;
    setActive(Math.round(track.scrollLeft / track.clientWidth));
  }

  function goTo(index: number) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <h2 className="font-heading text-2xl">{t("title")}</h2>
      <p className="mt-1.5 text-muted-foreground">{t("intro")}</p>

      {/* Swipeable carousel — one help card per view. */}
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="mt-6 flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {CARDS.map(({ key, Icon }, index) => (
          <div key={key} className="w-full shrink-0 basis-full snap-center px-0.5">
            <div className="flex min-h-72 flex-col items-center justify-center gap-5 rounded-2xl border border-border bg-card p-8 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/15">
                <Icon className="size-8 text-primary" aria-hidden />
              </div>
              <div className="max-w-sm">
                <p className="text-xs tabular-nums text-muted-foreground">
                  {index + 1} / {CARDS.length}
                </p>
                <p className="mt-1 font-heading text-xl">
                  {t(`cards.${key}.title`)}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(`cards.${key}.body`, cardParams)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dot indicators (tap to jump). */}
      <div className="mt-5 flex items-center justify-center gap-2">
        {CARDS.map(({ key }, index) => (
          <button
            key={key}
            type="button"
            onClick={() => goTo(index)}
            aria-label={t(`cards.${key}.title`)}
            aria-current={index === active}
            className={cn(
              "h-2 cursor-pointer rounded-full transition-all",
              index === active ? "w-6 bg-primary" : "w-2 bg-border hover:bg-primary/50"
            )}
          />
        ))}
      </div>

      <Button
        type="button"
        onClick={onContinue}
        className="mt-8 h-11 w-full cursor-pointer font-semibold"
      >
        {t("start")}
      </Button>
    </div>
  );
}
