"use client";

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AuthAlert } from "@/components/auth/auth-alert";
import { PitchView } from "@/components/pitch/pitch-view";
import { PlayerChip } from "@/components/pitch/player-chip";
import { trySwap, type LineupState } from "@/lib/game/lineup";
import { POSITION_ORDER, type Position, type SquadSettings } from "@/lib/game/squad";
import type { MarketPlayer } from "@/lib/game/queries";

type LineupStepProps = {
  players: MarketPlayer[]; // the picked 15
  settings: SquadSettings;
  lineup: LineupState;
  onLineupChange: (lineup: LineupState) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function LineupStep({
  players,
  settings,
  lineup,
  onLineupChange,
  onBack,
  onContinue,
}: LineupStepProps) {
  const t = useTranslations("onboarding.lineup");
  const tCommon = useTranslations("onboarding");
  const tPos = useTranslations("positionsShort");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);

  const byId = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );

  const groups = useMemo(() => {
    const result: Record<Position, MarketPlayer[]> = {
      GK: [],
      DEF: [],
      MID: [],
      FWD: [],
    };
    for (const id of lineup.starterIds) {
      const player = byId.get(id);
      if (player) result[player.position].push(player);
    }
    for (const pos of POSITION_ORDER) {
      result[pos].sort((a, b) => b.price - a.price);
    }
    return result;
  }, [lineup.starterIds, byId]);

  const benchPlayers = lineup.benchIds.map((id) => byId.get(id)!);

  function handleTap(id: string) {
    setSwapError(null);

    if (!selectedId) {
      setSelectedId(id);
      return;
    }
    if (selectedId === id) {
      setSelectedId(null);
      return;
    }

    const result = trySwap(lineup, selectedId, id, byId, settings);
    if (result.error) {
      setSwapError(result.error);
      setSelectedId(null);
      return;
    }
    if (result.state) {
      onLineupChange(result.state);
      setSelectedId(null);
      return;
    }
    // No-op pair (e.g. two starters): move the selection instead.
    setSelectedId(id);
  }

  /** Dim players that can't complete a swap with the current selection. */
  function isDimmed(id: string): boolean {
    if (!selectedId || selectedId === id) return false;
    const result = trySwap(lineup, selectedId, id, byId, settings);
    return Boolean(result.error);
  }

  function chip(player: MarketPlayer, benchOrder?: number) {
    return (
      <PlayerChip
        key={player.id}
        player={player}
        caption={tPos(player.position)}
        selected={selectedId === player.id}
        dimmed={isDimmed(player.id)}
        benchOrder={benchOrder}
        onClick={() => handleTap(player.id)}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div>
        <h2 className="font-heading text-2xl">{t("title")}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("hint")}</p>
      </div>

      {swapError && (
        <AuthAlert
          variant="error"
          message={t(`errors.${swapError}`, {
            def: settings.minDef,
            mid: settings.minMid,
            fwd: settings.minFwd,
          })}
        />
      )}

      <PitchView groups={groups} renderPlayer={(p) => chip(p)} animateEntrance />

      {/* Bench: slot 0 fixed GK, then outfield substitutes in priority order */}
      <section
        className="rounded-xl border border-border bg-card p-3"
        aria-label={t("bench")}
      >
        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("bench")}
        </h3>
        <div className="flex items-start justify-center gap-3 sm:gap-5">
          {benchPlayers.map((player, index) =>
            chip(player, index === 0 ? undefined : index)
          )}
        </div>
      </section>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="h-11 cursor-pointer"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {tCommon("back")}
        </Button>
        <Button
          type="button"
          onClick={onContinue}
          className="h-11 flex-1 cursor-pointer font-semibold sm:ml-auto sm:max-w-xs sm:flex-none sm:px-10"
        >
          {tCommon("continue")}
        </Button>
      </div>
    </div>
  );
}
