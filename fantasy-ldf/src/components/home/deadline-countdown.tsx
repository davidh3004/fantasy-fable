"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

type DeadlineCountdownProps = {
  deadline: string; // ISO string (serializable across the RSC boundary)
};

// Subscribe to a 1s clock via an external store — the React-blessed way to
// read a mutable external source without setState-in-effect.
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
}
// Seconds resolution keeps the snapshot stable within a tick.
const getSnapshot = () => Math.floor(Date.now() / 1000);
const getServerSnapshot = () => 0;

export function DeadlineCountdown({ deadline }: DeadlineCountdownProps) {
  const t = useTranslations("home.deadline");
  const nowSec = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const targetMs = new Date(deadline).getTime();
  const pending = nowSec === 0; // server render / first paint
  const diff = pending ? 0 : targetMs - nowSec * 1000;

  if (!pending && diff <= 0) {
    return <p className="font-heading text-xl">{t("closed")}</p>;
  }

  const remaining = pending
    ? null
    : {
        days: Math.floor(diff / 86_400_000),
        hours: Math.floor(diff / 3_600_000) % 24,
        minutes: Math.floor(diff / 60_000) % 60,
        seconds: Math.floor(diff / 1_000) % 60,
      };

  const blocks: Array<{ key: "days" | "hours" | "minutes" | "seconds" }> = [
    { key: "days" },
    { key: "hours" },
    { key: "minutes" },
    { key: "seconds" },
  ];

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-2"
      role="timer"
      aria-live="off"
    >
      {blocks.map(({ key }) => {
        const value = remaining ? remaining[key] : null;
        return (
          <div
            key={key}
            className="flex min-w-14 flex-col items-center rounded-lg bg-background/60 px-2 py-1.5"
          >
            <span className="font-heading text-xl tabular-nums">
              {value === null ? "--" : String(value).padStart(2, "0")}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t(key)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
