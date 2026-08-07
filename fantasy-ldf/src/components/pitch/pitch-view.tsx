"use client";

import type { CSSProperties, ReactNode } from "react";
import { PitchMarkings } from "./pitch-markings";
import { cn } from "@/lib/utils";
import type { MarketPlayer } from "@/lib/game/queries";
import { PITCH_LINES } from "@/lib/game/lineup";
import type { Position } from "@/lib/game/squad";

type PitchViewProps = {
  /** Starters grouped per line; rendered GK (top) → FWD (bottom). */
  groups: Record<Position, MarketPlayer[]>;
  renderPlayer: (player: MarketPlayer) => ReactNode;
  /**
   * Drop the position lines in on mount (onboarding). Opt-in: the team and
   * transfers editors run their own FLIP swap animation, and a mount
   * animation would replay whenever a chip moves between lines.
   */
  animateEntrance?: boolean;
};

/** Green pitch surface with markings and one row per position line. */
export function PitchView({
  groups,
  renderPlayer,
  animateEntrance = false,
}: PitchViewProps) {
  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-xl">
      {/* min-h wins over max-h when the two conflict, so the four card rows can
          never be squeezed past the pitch edge on short viewports. */}
      <div className="relative aspect-[3/4] max-h-[min(62vh,34rem)] min-h-[26rem] w-full bg-gradient-to-b from-[#15532e] via-[#1b6b3a] to-[#155230]">
        <PitchMarkings />
        {/* py clears the painted boundary line (3% inset) plus the C/V badge
            that overhangs the top of a card. */}
        <div className="relative z-[1] flex h-full flex-col justify-between px-3 py-6 sm:px-5">
          {PITCH_LINES.map((line, index) => (
            <div
              key={line}
              className={cn(
                "flex flex-nowrap items-start justify-evenly gap-1",
                animateEntrance && "animate-drop-in"
              )}
              style={
                animateEntrance ? ({ "--i": index } as CSSProperties) : undefined
              }
            >
              {groups[line].map((player) => renderPlayer(player))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
