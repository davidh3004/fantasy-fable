"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight, Clock } from "lucide-react";
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
import type { BreakdownRow } from "@/lib/game/scoring";
import type { MarketPlayer } from "@/lib/game/queries";

export type PlayerGameweekRecord = {
  gameweekId: string;
  number: number;
  breakdown: BreakdownRow[];
  points: number | null;
};

const STATUS_DOT: Record<MarketPlayer["status"], string> = {
  available: "bg-emerald-400",
  injured: "bg-red-400",
  suspended: "bg-yellow-400",
  unavailable: "bg-slate-400",
};

/** Categories whose count reads better as a bare number than a "×n". */
const MEASURED = new Set(["minutes", "saves", "goalsConceded"]);

type PlayerModalProps = {
  player: MarketPlayer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isStarter: boolean;
  isCaptain: boolean;
  isVice: boolean;
  /** Sub-line shown in specs: next fixture or points. */
  fixtureLabel?: string;
  /**
   * Lineup actions are only meaningful before the deadline. When false the
   * whole action block is dropped and this is a read-only stats sheet.
   */
  canEdit?: boolean;
  /**
   * The player's record, one entry per started gameweek, oldest first. The
   * modal steps through these so a player can be judged across the season
   * rather than only in the gameweek that happened to be on screen.
   */
  history?: PlayerGameweekRecord[];
  /** Which gameweek to open on. Falls back to the most recent. */
  defaultGameweekId?: string;
  /** Extra actions rendered under the stats (e.g. transfer in/out). */
  actions?: ReactNode;
  onSwitch?: () => void;
  onMakeCaptain?: () => void;
  onMakeVice?: () => void;
};

export function PlayerModal({
  player,
  open,
  onOpenChange,
  isStarter,
  isCaptain,
  isVice,
  fixtureLabel,
  canEdit = true,
  history,
  defaultGameweekId,
  actions,
  onSwitch,
  onMakeCaptain,
  onMakeVice,
}: PlayerModalProps) {
  const t = useTranslations("team");
  const tPos = useTranslations("positions");

  // Index into `history`. Starts on the requested gameweek — the one being
  // viewed on the page, or the most recent when the caller has no opinion.
  const defaultIndex = (() => {
    if (!history || history.length === 0) return 0;
    const wanted = history.findIndex((h) => h.gameweekId === defaultGameweekId);
    return wanted >= 0 ? wanted : history.length - 1;
  })();
  const [index, setIndex] = useState(defaultIndex);

  // Re-anchor whenever a different player is opened, or the caller's default
  // moves — otherwise the previous player's position sticks. Adjusted during
  // render (React's documented pattern) rather than in an effect, which would
  // paint the stale gameweek for a frame.
  const anchor = `${player?.id ?? ""}:${defaultIndex}`;
  const [prevAnchor, setPrevAnchor] = useState(anchor);
  if (prevAnchor !== anchor) {
    setPrevAnchor(anchor);
    setIndex(defaultIndex);
  }

  if (!player) return null;

  const specs = [
    { key: "position", value: tPos(player.position) },
    { key: "club", value: player.clubName },
    { key: "price", value: formatMoney(player.price) },
    ...(fixtureLabel ? [{ key: "nextFixture", value: fixtureLabel }] : []),
  ];

  // Only meaningful once a gameweek is under way — before that there's nothing
  // to explain, and an empty "didn't play" would be misleading.
  const showStats = history != null && history.length > 0;
  const current = showStats
    ? history[Math.min(index, history.length - 1)]
    : null;
  const breakdown = current?.breakdown ?? [];
  const hasPlayed = breakdown.length > 0;
  const totalPoints = current?.points ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Bottom sheet: anchored to the bottom edge, slides up on open */}
      <DialogContent
        className={cn(
          "top-auto bottom-0 left-1/2 flex max-h-[90dvh] w-full max-w-md -translate-x-1/2 translate-y-0 flex-col overflow-y-auto p-0 sm:max-w-md",
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
          className="relative flex h-36 shrink-0 items-end justify-center overflow-hidden rounded-t-2xl"
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
          {/* Gameweek total, anchored opposite the badge */}
          {totalPoints != null && (
            <span className="absolute right-2 bottom-2 rounded-lg bg-black/45 px-2.5 py-1 text-right backdrop-blur">
              <span className="block font-heading text-xl leading-none tabular-nums text-white">
                {totalPoints}
              </span>
              <span className="block text-[9px] uppercase tracking-wider text-white/70">
                {t("ptsLabel")}
              </span>
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

          {/* How the points were earned */}
          {showStats && current && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="flex-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t("breakdown.title")}
                </h3>
                {/* Step through the season jornada by jornada. */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIndex((i) => Math.max(0, i - 1))}
                    disabled={index <= 0}
                    aria-label={t("prevGw")}
                    className="flex size-7 cursor-pointer items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                  </button>
                  <span className="min-w-16 text-center text-xs font-medium tabular-nums">
                    {t("gameweek", { number: current.number })}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setIndex((i) => Math.min(history.length - 1, i + 1))
                    }
                    disabled={index >= history.length - 1}
                    aria-label={t("nextGw")}
                    className="flex size-7 cursor-pointer items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronRight className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
              {hasPlayed ? (
                <ul className="overflow-hidden rounded-lg border border-border">
                  {breakdown.map((row) => (
                    <li
                      key={row.key}
                      className="flex items-center gap-3 border-b border-border/50 bg-card px-3 py-2 text-sm last:border-0"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {t(`breakdown.${row.key}`)}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {MEASURED.has(row.key) ? row.count : `×${row.count}`}
                      </span>
                      <span
                        className={cn(
                          "w-9 shrink-0 text-right font-heading tabular-nums",
                          row.points > 0 && "text-emerald-400",
                          row.points < 0 && "text-destructive"
                        )}
                      >
                        {row.points > 0 ? `+${row.points}` : row.points}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  <Clock className="size-4 shrink-0" aria-hidden />
                  {t("breakdown.didNotPlay")}
                </p>
              )}
            </section>
          )}

          {actions}

          {/* Actions — only before the deadline */}
          {canEdit && (
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
