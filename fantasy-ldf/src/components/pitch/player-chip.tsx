"use client";

import { ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketPlayer } from "@/lib/game/queries";

type PlayerChipProps = {
  player: MarketPlayer;
  /** Bottom line: position, next fixture, or points. */
  caption?: string;
  selected?: boolean;
  dimmed?: boolean;
  captain?: boolean;
  vice?: boolean;
  benchOrder?: number;
  /** Marks an incoming transfer (green arrow, top-left corner). */
  transferIn?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  ref?: React.Ref<HTMLButtonElement>;
};

/** Head-and-shoulders silhouette shown when a player has no photo yet. */
function Silhouette() {
  return (
    <svg
      viewBox="0 0 40 40"
      className="h-10 w-10 text-white/75"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="20" cy="14" r="7" />
      <path d="M6 40c0-9 6.5-14 14-14s14 5 14 14z" />
    </svg>
  );
}

export function ClubBadge({
  player,
  className,
}: {
  player: MarketPlayer;
  className?: string;
}) {
  if (player.clubBadgeUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={player.clubBadgeUrl}
        alt={player.clubName}
        referrerPolicy="no-referrer"
        className={cn("size-5 rounded-full object-contain", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex size-5 items-center justify-center rounded-full text-[7px] font-bold text-white ring-1 ring-black/30",
        className
      )}
      style={{ backgroundColor: player.clubColor ?? "#7c3aed" }}
      aria-hidden
    >
      {player.clubShortName}
    </span>
  );
}

/** Tappable player card used on the pitch and the bench. */
export function PlayerChip({
  player,
  caption,
  selected = false,
  dimmed = false,
  captain = false,
  vice = false,
  benchOrder,
  transferIn = false,
  disabled = false,
  onClick,
  ref,
}: PlayerChipProps) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${player.firstName} ${player.lastName}`}
      className={cn(
        // Fluid width so a full position line (up to 5) always fits the pitch
        // on any screen; capped so lines with few players don't grow huge.
        "relative flex w-full min-w-0 max-w-[4.8rem] flex-col items-center transition-all",
        dimmed && "opacity-35",
        disabled ? "cursor-default" : "cursor-pointer",
        !dimmed && !disabled && "hover:-translate-y-0.5"
      )}
    >
      {/* Photo area, tinted with the club color */}
      <span
        className={cn(
          "relative flex h-12 w-full items-end justify-center overflow-hidden rounded-t-lg sm:h-13",
          selected && "ring-2 ring-cta"
        )}
        style={{
          background: `linear-gradient(180deg, ${player.clubColor ?? "#7c3aed"}cc 0%, ${player.clubColor ?? "#7c3aed"}66 100%)`,
        }}
        aria-hidden
      >
        {player.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.photoUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <Silhouette />
        )}
        {/* Club badge — bottom-left corner of the image */}
        <ClubBadge
          player={player}
          className="absolute bottom-0.5 left-0.5 size-4 text-[6px] sm:size-5"
        />
      </span>

      {(captain || vice) && (
        <span
          className={cn(
            "absolute -top-1.5 -right-1 z-[1] flex size-5 items-center justify-center rounded-full text-[10px] font-bold shadow",
            captain
              ? "bg-yellow-400 text-yellow-950"
              : "bg-slate-200 text-slate-800"
          )}
          aria-label={captain ? "Capitán" : "Vicecapitán"}
        >
          {captain ? "C" : "V"}
        </span>
      )}

      {benchOrder != null && (
        <span
          className="absolute -top-1.5 -left-1 z-[1] flex size-5 items-center justify-center rounded-full bg-secondary text-[10px] font-bold tabular-nums text-secondary-foreground shadow"
          aria-hidden
        >
          {benchOrder}
        </span>
      )}

      {transferIn && (
        <span
          className="absolute -top-1.5 -left-1 z-[1] flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow"
          aria-hidden
        >
          <ArrowLeftRight className="size-3" />
        </span>
      )}

      {/* Name plate */}
      <span className="w-full truncate bg-[#10102a]/95 px-1 py-0.5 text-center text-[10px] font-semibold leading-tight text-foreground">
        {player.lastName}
      </span>
      {caption && (
        <span className="w-full truncate rounded-b-lg bg-black/45 px-1 py-px text-center text-[9px] uppercase tracking-wide text-white/80">
          {caption}
        </span>
      )}
    </button>
  );
}
