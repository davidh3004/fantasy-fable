"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PitchView } from "@/components/pitch/pitch-view";
import { PlayerChip } from "@/components/pitch/player-chip";
import { POSITION_ORDER, type Position } from "@/lib/game/squad";
import type { MarketPlayer } from "@/lib/game/queries";
import type { OpponentInfo } from "@/components/team/lineup-editor";
import { PlayerModal } from "@/components/team/player-modal";
import {
  buildRuleLookup,
  explainPoints,
  type ScoringRuleRow,
  type StatLine,
} from "@/lib/game/scoring";

type ReadonlyPitchProps = {
  players: MarketPlayer[];
  starterIds: string[];
  benchIds: string[];
  captainId: string;
  viceId: string;
  opponents: Record<string, OpponentInfo>;
  pointsByPlayer: Record<string, number>;
  /** playerId → gameweek stat line, for the modal's points breakdown. */
  statLines?: Record<string, StatLine>;
  rules?: ScoringRuleRow[];
};

export function ReadonlyPitch({
  players,
  starterIds,
  benchIds,
  captainId,
  viceId,
  opponents,
  pointsByPlayer,
  statLines,
  rules,
}: ReadonlyPitchProps) {
  const t = useTranslations("team");
  const tPos = useTranslations("positionsShort");

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const byId = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );

  const rule = useMemo(
    () => (rules ? buildRuleLookup(rules) : null),
    [rules]
  );

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;

  /** Same breakdown as your own team — this squad just isn't editable. */
  function breakdownFor(player: MarketPlayer) {
    if (!rule || !statLines) return undefined;
    const stats = statLines[player.id];
    return stats ? explainPoints(stats, player.position, rule) : [];
  }

  const groups = useMemo(() => {
    const result: Record<Position, MarketPlayer[]> = {
      GK: [],
      DEF: [],
      MID: [],
      FWD: [],
    };
    for (const id of starterIds) {
      const player = byId.get(id);
      if (player) result[player.position].push(player);
    }
    for (const pos of POSITION_ORDER) {
      result[pos].sort((a, b) => b.price - a.price);
    }
    return result;
  }, [starterIds, byId]);

  const benchPlayers = benchIds
    .map((id) => byId.get(id))
    .filter((p): p is MarketPlayer => p != null);

  function caption(player: MarketPlayer): string {
    const points = pointsByPlayer[player.id];
    if (points != null) return t("points", { points });
    const info = opponents[player.clubId];
    if (info) {
      return t(info.home ? "fixtureHome" : "fixtureAway", { opp: info.opp });
    }
    return tPos(player.position);
  }

  function chip(player: MarketPlayer, benchOrder?: number) {
    return (
      <PlayerChip
        key={player.id}
        player={player}
        caption={caption(player)}
        captain={player.id === captainId}
        vice={player.id === viceId}
        benchOrder={benchOrder}
        onClick={() => setSelectedId(player.id)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PitchView groups={groups} renderPlayer={(p) => chip(p)} />
      <section
        className="rounded-xl border border-border bg-card p-3"
        aria-label={t("bench")}
      >
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("bench")}
        </h2>
        <div className="flex items-start justify-center gap-3 sm:gap-5">
          {benchPlayers.map((player, index) =>
            chip(player, index === 0 ? undefined : index)
          )}
        </div>
      </section>

      <PlayerModal
        player={selected}
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        isStarter={selectedId ? starterIds.includes(selectedId) : false}
        isCaptain={selectedId === captainId}
        isVice={selectedId === viceId}
        fixtureLabel={
          selected && opponents[selected.clubId]
            ? t(
                opponents[selected.clubId].home ? "fixtureHome" : "fixtureAway",
                { opp: opponents[selected.clubId].opp }
              )
            : undefined
        }
        canEdit={false}
        breakdown={selected ? breakdownFor(selected) : undefined}
        totalPoints={selected ? (pointsByPlayer[selected.id] ?? null) : null}
      />
    </div>
  );
}
