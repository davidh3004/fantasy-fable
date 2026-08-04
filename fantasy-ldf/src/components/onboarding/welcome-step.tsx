"use client";

import { useRef, useState, type CSSProperties } from "react";
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
  const isLast = active === CARDS.length - 1;

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
      <h2 className="animate-fade-up font-heading text-2xl">{t("title")}</h2>
      <p
        className="animate-fade-up mt-1.5 text-muted-foreground"
        style={{ "--i": 1 } as CSSProperties}
      >
        {t("intro")}
      </p>

      {/* Swipeable carousel — one help card per view. */}
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="mt-6 flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {CARDS.map(({ key, Icon }, index) => {
          const isActive = index === active;
          return (
            <div key={key} className="w-full shrink-0 basis-full snap-center px-0.5">
              <div
                className={cn(
                  "flex min-h-72 flex-col items-center justify-center gap-5 rounded-2xl border bg-card p-8 text-center transition-all duration-300",
                  isActive
                    ? "border-primary/40 shadow-lg shadow-primary/5"
                    : "border-border opacity-60"
                )}
              >
                <div
                  className={cn(
                    "flex size-16 items-center justify-center rounded-2xl bg-primary/15 transition-transform duration-300",
                    isActive && "animate-float"
                  )}
                >
                  <Icon className="size-8 text-primary" aria-hidden />
                </div>
                <div className="max-w-sm">
                  <p className="font-heading text-xl">{t(`cards.${key}.title`)}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(`cards.${key}.body`, cardParams)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
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
        onClick={() => (isLast ? onContinue() : goTo(active + 1))}
        className={cn(
          "mt-8 h-11 w-full cursor-pointer font-semibold transition-transform active:scale-[0.98]",
          isLast && "animate-ready-glow"
        )}
      >
        {/* keyed so the label pops when it switches to "Empezar" */}
        <span key={isLast ? "start" : "next"} className="animate-pop-in">
          {isLast ? t("start") : t("next")}
        </span>
      </Button>
    </div>
  );
}
