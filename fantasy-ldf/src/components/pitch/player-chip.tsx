"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeftRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { StatusIndicator } from "@/components/shared/status-indicator";
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
  /** Player's match is in play — gold border + gold points strip. */
  live?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /**
   * Enables pointer drag-to-swap: drag this card onto another and this fires
   * with the drop target's player id. Tap-to-swap keeps working alongside it.
   */
  onSwapWith?: (targetPlayerId: string) => void;
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

const DRAG_THRESHOLD_PX = 6;

/** Clears the drop-target highlight from every chip on the page. */
function clearDropTargets() {
  document
    .querySelectorAll("[data-drop-target]")
    .forEach((el) => el.removeAttribute("data-drop-target"));
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
  live = false,
  disabled = false,
  onClick,
  onSwapWith,
  ref,
}: PlayerChipProps) {
  const tStatus = useTranslations("team.status");
  const innerRef = useRef<HTMLButtonElement | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);

  const dragEnabled = Boolean(onSwapWith) && !disabled;

  function setRefs(el: HTMLButtonElement | null) {
    innerRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref)
      (ref as React.RefObject<HTMLButtonElement | null>).current = el;
  }

  /** The chip under the pointer, ignoring the one being dragged. */
  function chipAt(x: number, y: number): string | null {
    const node = innerRef.current;
    if (!node) return null;
    const previous = node.style.pointerEvents;
    node.style.pointerEvents = "none"; // so we hit what's underneath
    const element = document.elementFromPoint(x, y);
    node.style.pointerEvents = previous;
    const chip = element?.closest?.("[data-player-id]") as HTMLElement | null;
    const id = chip?.dataset.playerId;
    return id && id !== player.id ? id : null;
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragEnabled || event.button !== 0) return;
    startRef.current = { x: event.clientX, y: event.clientY };
    draggedRef.current = false;
    innerRef.current?.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const start = startRef.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!draggedRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

    draggedRef.current = true;
    setOffset({ x: dx, y: dy });

    clearDropTargets();
    const targetId = chipAt(event.clientX, event.clientY);
    if (targetId) {
      document
        .querySelector(`[data-player-id="${targetId}"]`)
        ?.setAttribute("data-drop-target", "true");
    }
  }

  function endDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!startRef.current) return;
    const wasDragging = draggedRef.current;
    startRef.current = null;
    setOffset(null);

    if (wasDragging) {
      const targetId = chipAt(event.clientX, event.clientY);
      clearDropTargets();
      if (targetId) onSwapWith?.(targetId);
      // Let the synthetic click fire first, then re-enable tap handling.
      setTimeout(() => {
        draggedRef.current = false;
      }, 0);
    }
  }

  const isDragging = offset !== null;

  return (
    <button
      ref={setRefs}
      type="button"
      data-player-id={player.id}
      onClick={() => {
        if (draggedRef.current) return; // this was a drag, not a tap
        onClick?.();
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${player.firstName} ${player.lastName}`}
      style={{
        ...(isDragging
          ? {
              transform: `translate(${offset.x}px, ${offset.y}px) scale(1.12) rotate(2deg)`,
              zIndex: 50,
            }
          : null),
        ...(dragEnabled ? { touchAction: "none" } : null),
      }}
      className={cn(
        // Fluid width so a full position line (up to 5) always fits the pitch
        // on any screen; capped so lines with few players don't grow huge.
        "relative flex w-full min-w-0 max-w-[4.8rem] flex-col items-center rounded-lg",
        // Gold ring while the player's match is in play (selection wins).
        live && !selected && "ring-2 ring-amber-400",
        // The selection ring wraps the whole card, not just the photo.
        selected && "ring-2 ring-cta",
        // Highlight while another card is dragged over this one.
        "data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-emerald-400",
        isDragging
          ? "cursor-grabbing shadow-2xl"
          : "transition-all duration-200",
        dimmed && "opacity-35",
        disabled ? "cursor-default" : dragEnabled ? "cursor-grab" : "cursor-pointer",
        !dimmed && !disabled && !isDragging && "hover:-translate-y-0.5"
      )}
    >
      {/* Photo area, tinted with the club color */}
      <span
        className="relative flex h-12 w-full items-end justify-center overflow-hidden rounded-t-lg sm:h-13"
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
            draggable={false}
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
        {/* Availability flag — bottom-right, so it can't collide with the
            armband (top-right) or the bench/transfer marker (top-left). */}
        <StatusIndicator
          status={player.status}
          className="absolute right-0.5 bottom-0.5 size-4"
        />
      </span>

      {(captain || vice) && (
        // Keyed on the role so the armband re-pops when C/V changes hands.
        <span
          key={captain ? "captain" : "vice"}
          className={cn(
            "animate-pop-in absolute -top-1.5 -right-1 z-[1] flex size-5 items-center justify-center rounded-full text-[10px] font-bold shadow",
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
      <span
        className={cn(
          "w-full truncate bg-[#10102a]/95 px-1 py-0.5 text-center text-[10px] font-semibold leading-tight text-foreground",
          !caption && "rounded-b-lg"
        )}
      >
        {player.lastName}
      </span>
      {/* The badge above sits inside an aria-hidden region, so the status is
          announced here instead of being lost. */}
      {player.status !== "available" && (
        <span className="sr-only">{tStatus(player.status)}</span>
      )}
      {caption && (
        <span
          className={cn(
            "w-full truncate rounded-b-lg px-1 py-px text-center text-[9px] uppercase tracking-wide",
            live
              ? "bg-amber-400 font-bold text-amber-950"
              : "bg-black/45 text-white/80"
          )}
        >
          {caption}
        </span>
      )}
    </button>
  );
}
