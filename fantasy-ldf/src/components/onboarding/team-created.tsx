"use client";

import { useEffect, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

/** How long the celebration stays up before moving on to the dashboard. */
const HOLD_MS = 2800;

// Fixed (not random) so the server and client markup always match.
const CONFETTI = [
  { left: "8%", delay: 0, color: "var(--primary)" },
  { left: "20%", delay: 220, color: "var(--cta)" },
  { left: "33%", delay: 90, color: "#facc15" },
  { left: "47%", delay: 320, color: "#34d399" },
  { left: "61%", delay: 150, color: "var(--primary)" },
  { left: "74%", delay: 400, color: "#22d3ee" },
  { left: "88%", delay: 60, color: "var(--cta)" },
];

export function TeamCreated({ teamName }: { teamName: string }) {
  const t = useTranslations("onboarding.created");
  const router = useRouter();

  useEffect(() => {
    const id = setTimeout(() => {
      router.replace("/home");
    }, HOLD_MS);
    return () => clearTimeout(id);
  }, [router]);

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* Confetti */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {CONFETTI.map((piece, index) => (
          <span
            key={index}
            className="animate-confetti absolute top-0 block size-2 rounded-[2px]"
            style={
              {
                left: piece.left,
                backgroundColor: piece.color,
                animationDelay: `${piece.delay}ms`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      {/* Badge */}
      <div className="relative">
        <span
          className="animate-ping-ring absolute inset-0 rounded-full border-2 border-primary"
          aria-hidden
        />
        <span className="animate-pop-in flex size-24 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30">
          <Check className="size-12 text-primary-foreground" aria-hidden />
        </span>
      </div>

      <h1
        className="animate-fade-up mt-8 font-heading text-3xl"
        style={{ "--i": 3 } as CSSProperties}
      >
        {t("title")}
      </h1>
      <p
        className="animate-fade-up mt-2 flex items-center gap-2 font-heading text-xl text-primary"
        style={{ "--i": 5 } as CSSProperties}
      >
        <Sparkles className="size-5" aria-hidden />
        {teamName}
      </p>
      <p
        className="animate-fade-up mt-3 max-w-sm text-sm text-muted-foreground"
        style={{ "--i": 7 } as CSSProperties}
      >
        {t("body")}
      </p>

      {/* Progress line that empties as the redirect approaches */}
      <div
        className="mt-8 h-1 w-40 overflow-hidden rounded-full bg-muted"
        aria-hidden
      >
        <span
          className="animate-countdown-bar block h-full w-full origin-left bg-primary"
          style={{ animationDuration: `${HOLD_MS}ms` }}
        />
      </div>
      <p className="sr-only" role="status">
        {t("redirecting")}
      </p>
    </main>
  );
}
