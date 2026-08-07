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
import { ClubCrest } from "@/components/shared/club-badge";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/game/format";
import type { BreakdownRow } from "@/lib/game/scoring";
import type { MarketPlayer } from "@/lib/game/queries";

export type PlayerGameweekRecord = {
  gameweekId: string;
  number: number;
  breakdown: BreakdownRow[];
  points: number | null;
  /** Club(s) faced that gameweek, short form. Absent if they didn't play. */
  opponent?: string;
};

/**
 * Dissolves the photo's right edge into the club colour behind it. Set both
 * ways round: iOS Safari before 15.4 only honours the prefixed property.
 */
const PHOTO_FADE = {
  maskImage:
    "linear-gradient(to right, black 0%, black 58%, transparent 98%)",
  WebkitMaskImage:
    "linear-gradient(to right, black 0%, black 58%, transparent 98%)",
} as const;

const STATUS_TEXT: Record<MarketPlayer["status"], string> = {
  available: "text-emerald-300",
  injured: "text-red-300",
  suspended: "text-yellow-300",
  unavailable: "text-slate-300",
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

  // Only meaningful once a gameweek is under way — before that there's nothing
  // to explain, and an empty "didn't play" would be misleading.
  const showStats = history != null && history.length > 0;
  const current = showStats
    ? history[Math.min(index, history.length - 1)]
    : null;

  // Tiles inside the header. Position and club sit under the name, so they're
  // not repeated here; the gameweek tile tracks the stepper below.
  const specs: Array<{ key: string; value: string; tone?: string }> = [
    { key: "price", value: formatMoney(player.price) },
    ...(fixtureLabel ? [{ key: "nextFixture", value: fixtureLabel }] : []),
    ...(current
      ? [{ key: "gameweek", value: String(current.number) }]
      : []),
    {
      key: "status",
      value: t(`status.${player.status}`),
      tone: STATUS_TEXT[player.status],
    },
  ];
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
        {/* Identity. The photo bleeds off the left edge and dissolves into
            the club colour rather than sitting in its own box, so the header
            reads as one surface; the fact tiles float on that same surface. */}
        <div
          className="relative shrink-0 overflow-hidden rounded-t-2xl"
          style={{
            background: `linear-gradient(115deg, ${player.clubColor ?? "#7c3aed"} 0%, ${player.clubColor ?? "#7c3aed"}b3 42%, #14142e 100%)`,
          }}
        >
          {/* Photo layer — masked so its right edge fades out instead of
              ending on a hard line. */}
          <div className="absolute inset-y-0 left-0 w-[42%]">
            {player.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={player.photoUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover object-top"
                style={PHOTO_FADE}
              />
            ) : (
              <span className="flex h-full items-end justify-center">
                <svg
                  viewBox="0 0 40 40"
                  className="size-24 text-white/60"
                  style={PHOTO_FADE}
                  fill="currentColor"
                  aria-hidden
                >
                  <circle cx="20" cy="14" r="7" />
                  <path d="M6 40c0-9 6.5-14 14-14s14 5 14 14z" />
                </svg>
              </span>
            )}
          </div>

          {/* Scrim under the photo's lower edge: player photos are arbitrary,
              and the availability line has to stay readable over all of them. */}
          <div
            className="pointer-events-none absolute bottom-0 left-0 h-16 w-[42%] bg-gradient-to-t from-black/70 to-transparent"
            aria-hidden
          />

          {/* Club crest, top-left over the photo */}
          <ClubBadge
            player={player}
            className="absolute top-2.5 left-2.5 z-[1] size-9 text-[10px]"
          />

          {(isCaptain || isVice) && (
            <span
              className={cn(
                "absolute top-2.5 left-13 z-[1] flex size-6 items-center justify-center rounded-full text-xs font-bold shadow",
                isCaptain
                  ? "bg-yellow-400 text-yellow-950"
                  : "bg-slate-200 text-slate-800"
              )}
            >
              {isCaptain ? "C" : "V"}
            </span>
          )}

          {/* Availability, bottom-left over the photo */}
          <span className="absolute bottom-2.5 left-2.5 z-[1] flex items-center gap-1.5 text-[11px] font-medium text-white/90">
            <span
              className={cn("size-2 rounded-full", STATUS_DOT[player.status])}
              aria-hidden
            />
            {t(`status.${player.status}`)}
          </span>

          {/* Text column, clear of the photo */}
          <div className="relative ml-[42%] flex flex-col gap-2 py-3 pr-4 pl-1">
            <DialogHeader className="gap-0.5 text-left">
              <DialogTitle className="truncate pr-6 text-xl leading-tight text-white">
                {player.firstName} {player.lastName}
              </DialogTitle>
              <p className="text-xs text-white/70">{tPos(player.position)}</p>
              <p className="flex items-center gap-1.5 text-xs text-white/90">
                <ClubCrest
                  shortName={player.clubShortName}
                  name={player.clubName}
                  color={player.clubColor}
                  badgeUrl={player.clubBadgeUrl}
                  className="size-4 text-[6px]"
                />
                <span className="truncate">{player.clubName}</span>
              </p>
            </DialogHeader>

            {/* Fact tiles, translucent so the club colour reads through */}
            <dl className="grid grid-cols-2 gap-1.5">
              {specs.map(({ key, value, tone }) => (
                <div
                  key={key}
                  className="rounded-lg bg-black/30 px-2 py-1.5 backdrop-blur-sm"
                >
                  <dt className="truncate text-[9px] uppercase tracking-wider text-white/55">
                    {t(`specs.${key}`)}
                  </dt>
                  <dd
                    className={cn(
                      "mt-0.5 truncate text-sm font-semibold",
                      tone ?? "text-white"
                    )}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-4">
          {/* How the points were earned */}
          {showStats && current && (
            <section>
              {/* Step through the season jornada by jornada. */}
              <div className="mb-2 flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIndex((i) => Math.max(0, i - 1))}
                    disabled={index <= 0}
                    aria-label={t("prevGw")}
                    className="flex size-7 cursor-pointer items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                  </button>
                  <span className="min-w-20 text-center text-sm font-semibold tabular-nums">
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
                {/* Who they were up against — the breakdown means little
                    without knowing the opposition. */}
                <p className="text-[11px] text-muted-foreground">
                  {current.opponent
                    ? t("versus", { opp: current.opponent })
                    : t("breakdown.noMatch")}
                </p>
                {totalPoints != null && (
                  <p className="mt-1 flex items-baseline gap-1.5">
                    <span className="font-heading text-2xl leading-none tabular-nums">
                      {totalPoints}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t("ptsLabel")}
                    </span>
                  </p>
                )}
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
