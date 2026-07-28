"use client";

import type { ReactNode } from "react";
import { PitchMarkings } from "./pitch-markings";
import type { MarketPlayer } from "@/lib/game/queries";
import { PITCH_LINES } from "@/lib/game/lineup";
import type { Position } from "@/lib/game/squad";

type PitchViewProps = {
  /** Starters grouped per line; rendered GK (top) → FWD (bottom). */
  groups: Record<Position, MarketPlayer[]>;
  renderPlayer: (player: MarketPlayer) => ReactNode;
};

/** Green pitch surface with markings and one row per position line. */
export function PitchView({ groups, renderPlayer }: PitchViewProps) {
  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-xl">
      <div className="relative aspect-[3/4] max-h-[min(62vh,34rem)] min-h-[24rem] w-full bg-gradient-to-b from-[#15532e] via-[#1b6b3a] to-[#155230]">
        <PitchMarkings />
        <div className="relative z-[1] flex h-full flex-col justify-between px-1 py-4 sm:px-2">
          {PITCH_LINES.map((line) => (
            <div
              key={line}
              className="flex flex-nowrap items-start justify-evenly gap-1"
            >
              {groups[line].map((player) => renderPlayer(player))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
