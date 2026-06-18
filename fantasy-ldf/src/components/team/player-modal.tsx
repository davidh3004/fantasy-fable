"use client";

import { ArrowLeftRight } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClubBadge } from "@/components/pitch/player-chip";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/game/format";
import type { MarketPlayer } from "@/lib/game/queries";

const STATUS_DOT: Record<MarketPlayer["status"], string> = {
  available: "bg-emerald-400",
  injured: "bg-red-400",
  suspended: "bg-yellow-400",
  unavailable: "bg-slate-400",
};

type PlayerModalProps = {
  player: MarketPlayer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isStarter: boolean;
  isCaptain: boolean;
  isVice: boolean;
  /** Sub-line shown in specs: next fixture or points. */
  fixtureLabel?: string;
  onSwitch: () => void;
  onMakeCaptain: () => void;
  onMakeVice: () => void;
};

export function PlayerModal({
  player,
  open,
  onOpenChange,
  isStarter,
  isCaptain,
  isVice,
  fixtureLabel,
  onSwitch,
  onMakeCaptain,
  onMakeVice,
}: PlayerModalProps) {
  const t = useTranslations("team");
  const tPos = useTranslations("positions");

  if (!player) return null;

  const specs = [
    { key: "position", value: tPos(player.position) },
    { key: "club", value: player.clubName },
    { key: "price", value: formatMoney(player.price) },
    ...(fixtureLabel
      ? [{ key: "nextFixture", value: fixtureLabel }]
      : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Bottom sheet: anchored to the bottom edge, slides up on open */}
      <DialogContent
        className={cn(
          "top-auto bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 translate-y-0 p-0 sm:max-w-md",
          "rounded-t-2xl rounded-b-none pb-[env(safe-area-inset-bottom)]",
          "duration-300 data-closed:duration-200",
          "data-open:zoom-in-100 data-closed:zoom-out-100",
          "data-open:slide-in-from-bottom-[100%] data-closed:slide-out-to-bottom-[100%]"
        )}
        showCloseButton
      >
        {/* Sheet grab handle */}
        <span
          className="absolute top-2 left-1/2 z-[1] h-1 w-10 -translate-x-1/2 rounded-full bg-white/30"
          aria-hidden
        />
        {/* Hero: photo over club color */}
        <div
          className="relative flex h-36 items-end justify-center overflow-hidden rounded-t-2xl"
          style={{
            background: `linear-gradient(180deg, ${player.clubColor ?? "#7c3aed"} 0%, #181830 130%)`,
          }}
        >
          {player.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.photoUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="h-full object-cover object-top"
            />
          ) : (
            <svg
              viewBox="0 0 40 40"
              className="h-28 w-28 text-white/70"
              fill="currentColor"
              aria-hidden
            >
              <circle cx="20" cy="14" r="7" />
              <path d="M6 40c0-9 6.5-14 14-14s14 5 14 14z" />
            </svg>
          )}
          <ClubBadge
            player={player}
            className="absolute bottom-2 left-2 size-8 text-[10px]"
          />
          {(isCaptain || isVice) && (
            <span
              className={cn(
                "absolute top-2 left-2 flex size-6 items-center justify-center rounded-full text-xs font-bold shadow",
                isCaptain
                  ? "bg-yellow-400 text-yellow-950"
                  : "bg-slate-200 text-slate-800"
              )}
            >
              {isCaptain ? "C" : "V"}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-4 p-4 pt-0">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {player.firstName} {player.lastName}
            </DialogTitle>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span
                className={cn("size-2 rounded-full", STATUS_DOT[player.status])}
                aria-hidden
              />
              {t(`status.${player.status}`)}
            </p>
          </DialogHeader>

          {/* Specs */}
          <dl className="grid grid-cols-2 gap-2">
            {specs.map(({ key, value }) => (
              <div
                key={key}
                className="rounded-lg border border-border bg-card px-3 py-2"
              >
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t(`specs.${key}`)}
                </dt>
                <dd className="mt-0.5 truncate text-sm font-semibold">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              onClick={onSwitch}
              className="h-11 w-full cursor-pointer font-semibold"
            >
              <ArrowLeftRight className="size-4" aria-hidden />
              {t("actions.switch")}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={!isStarter || isCaptain}
                onClick={onMakeCaptain}
                className="h-11 cursor-pointer"
              >
                <span
                  className="flex size-4.5 items-center justify-center rounded-full bg-yellow-400 text-[9px] font-bold text-yellow-950"
                  aria-hidden
                >
                  C
                </span>
                {t("actions.captain")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!isStarter || isVice}
                onClick={onMakeVice}
                className="h-11 cursor-pointer"
              >
                <span
                  className="flex size-4.5 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-800"
                  aria-hidden
                >
                  V
                </span>
                {t("actions.vice")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
