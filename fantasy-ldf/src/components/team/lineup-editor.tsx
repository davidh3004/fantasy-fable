"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, RotateCcw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthAlert } from "@/components/auth/auth-alert";
import { PitchView } from "@/components/pitch/pitch-view";
import { PlayerChip } from "@/components/pitch/player-chip";
import { useFlip } from "@/components/pitch/use-flip";
import { PlayerModal } from "@/components/team/player-modal";
import { cn } from "@/lib/utils";
import { saveLineup } from "@/app/(app)/team/actions";
import { trySwap, type LineupState } from "@/lib/game/lineup";
import {
  POSITION_ORDER,
  type Position,
  type SquadSettings,
} from "@/lib/game/squad";
import type { MarketPlayer } from "@/lib/game/queries";
import {
  buildRuleLookup,
  explainPoints,
  type ScoringRuleRow,
  type StatLine,
} from "@/lib/game/scoring";

export type OpponentInfo = { opp: string; home: boolean };

type LineupEditorProps = {
  players: MarketPlayer[]; // the squad of 15
  settings: SquadSettings;
  initialLineup: LineupState;
  initialCaptainId: string;
  initialViceId: string;
  locked: boolean;
  /** clubId → next opponent (for the card caption + modal). */
  opponents: Record<string, OpponentInfo>;
  /** playerId → points, once the gameweek has been scored. */
  pointsByPlayer: Record<string, number>;
  /** playerIds whose match is in play right now (gold treatment). */
  livePlayerIds?: string[];
  /** playerId → gameweek stat line, for the modal's points breakdown. */
  statLines?: Record<string, StatLine>;
  /** Season scoring rules, so the breakdown matches the engine exactly. */
  rules?: ScoringRuleRow[];
};

export function LineupEditor({
  players,
  settings,
  initialLineup,
  initialCaptainId,
  initialViceId,
  locked,
  opponents,
  pointsByPlayer,
  livePlayerIds,
  statLines,
  rules,
}: LineupEditorProps) {
  const t = useTranslations("team");
  const tPos = useTranslations("positionsShort");
  const livePlayers = useMemo(
    () => new Set(livePlayerIds ?? []),
    [livePlayerIds]
  );

  const [lineup, setLineup] = useState(initialLineup);
  const [captainId, setCaptainId] = useState(initialCaptainId);
  const [viceId, setViceId] = useState(initialViceId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [swapMode, setSwapMode] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Chips glide to their new slots after a swap.
  const { register, snapshot } = useFlip(lineup);

  const byId = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );

  const rule = useMemo(
    () => (rules ? buildRuleLookup(rules) : null),
    [rules]
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
  const selected = selectedId ? byId.get(selectedId) : null;
  const selectedIsStarter = selectedId
    ? lineup.starterIds.includes(selectedId)
    : false;

  function clearSelection() {
    setSelectedId(null);
    setSwapMode(false);
    setModalOpen(false);
  }

  /** Keep captain/vice valid after a swap benches one of them. */
  function reconcileCaptaincy(next: LineupState) {
    let nextCaptain = captainId;
    let nextVice = viceId;
    if (!next.starterIds.includes(nextCaptain)) {
      nextCaptain = next.starterIds[0];
    }
    if (!next.starterIds.includes(nextVice) || nextVice === nextCaptain) {
      nextVice = next.starterIds.find((id) => id !== nextCaptain) ?? nextVice;
    }
    setCaptainId(nextCaptain);
    setViceId(nextVice);
  }

  function handleTap(id: string) {
    setMessage(null);

    // The modal is readable in every state — only its actions are gated, so a
    // locked gameweek can still be inspected player by player.
    if (!swapMode) {
      setSelectedId(id);
      setModalOpen(true);
      return;
    }

    // Swap mode: selectedId is fixed, this tap picks the swap target. Only
    // reachable from the modal's Switch button, which is hidden when locked —
    // guarded anyway so the lock can't be bypassed.
    if (locked || id === selectedId) {
      clearSelection();
      return;
    }
    const result = trySwap(lineup, selectedId!, id, byId, settings);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    if (result.state) {
      snapshot();
      setLineup(result.state);
      reconcileCaptaincy(result.state);
      setDirty(true);
    }
    clearSelection();
  }

  /** Drag-and-drop swap: source card dropped onto the target card. */
  function handleDragSwap(sourceId: string, targetId: string) {
    if (locked) return;
    setMessage(null);
    const result = trySwap(lineup, sourceId, targetId, byId, settings);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    if (result.state) {
      snapshot();
      setLineup(result.state);
      reconcileCaptaincy(result.state);
      setDirty(true);
    }
    clearSelection();
  }

  function assignRole(role: "captain" | "vice") {
    if (!selectedId || !selectedIsStarter) return;
    if (role === "captain") {
      setViceId(selectedId === viceId ? captainId : viceId);
      setCaptainId(selectedId);
    } else {
      setCaptainId(selectedId === captainId ? viceId : captainId);
      setViceId(selectedId);
    }
    setDirty(true);
    clearSelection();
  }

  function handleDiscard() {
    snapshot();
    setLineup(initialLineup);
    setCaptainId(initialCaptainId);
    setViceId(initialViceId);
    setDirty(false);
    setMessage(null);
    clearSelection();
  }

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveLineup({
        starterIds: lineup.starterIds,
        benchIds: lineup.benchIds,
        captainId,
        viceId,
      });
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setDirty(false);
      toast.success(t("saved"));
    });
  }

  /** In swap mode, dim players that can't complete the swap. */
  function isDimmed(id: string): boolean {
    if (!swapMode || !selectedId || selectedId === id) return false;
    const result = trySwap(lineup, selectedId, id, byId, settings);
    return Boolean(result.error);
  }

  function fixtureLabel(player: MarketPlayer): string | undefined {
    const info = opponents[player.clubId];
    if (!info) return undefined;
    return t(info.home ? "fixtureHome" : "fixtureAway", { opp: info.opp });
  }

  /**
   * How this player earned their gameweek points. Undefined before any stats
   * exist, so the modal knows to omit the section entirely rather than claim
   * the player didn't feature.
   */
  function breakdownFor(player: MarketPlayer) {
    if (!rule || !statLines) return undefined;
    const stats = statLines[player.id];
    return stats ? explainPoints(stats, player.position, rule) : [];
  }

  function caption(player: MarketPlayer): string {
    const points = pointsByPlayer[player.id];
    if (points != null) return t("points", { points });
    return fixtureLabel(player) ?? tPos(player.position);
  }

  function chip(player: MarketPlayer, benchOrder?: number) {
    return (
      <PlayerChip
        key={player.id}
        ref={register(player.id)}
        player={player}
        caption={caption(player)}
        selected={selectedId === player.id}
        dimmed={isDimmed(player.id)}
        captain={player.id === captainId}
        vice={player.id === viceId}
        benchOrder={benchOrder}
        live={livePlayers.has(player.id)}
        onClick={() => handleTap(player.id)}
        onSwapWith={(targetId) => handleDragSwap(player.id, targetId)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {message && (
        <AuthAlert
          variant="error"
          message={t(`errors.${message}`, {
            def: settings.minDef,
            mid: settings.minMid,
            fwd: settings.minFwd,
          })}
        />
      )}

      <PitchView groups={groups} renderPlayer={(p) => chip(p)} />

      {/* Swap-mode hint */}
      {swapMode && selected && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-card px-3.5 py-2.5">
          <p className="min-w-0 flex-1 truncate text-sm">
            {t("switchHint", {
              name: `${selected.firstName} ${selected.lastName}`,
            })}
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={clearSelection}
            className="h-9 cursor-pointer"
            aria-label={t("actions.cancel")}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      )}

      {/* Bench */}
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

      {/* Save bar */}
      {dirty && !locked && (
        <div
          className={cn(
            "sticky bottom-20 z-30 flex items-center gap-2 rounded-xl border border-border",
            "bg-background/95 p-2.5 backdrop-blur lg:bottom-4"
          )}
        >
          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={isPending}
            className="h-11 cursor-pointer"
          >
            <RotateCcw className="size-4" aria-hidden />
            {t("discard")}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="h-11 flex-1 cursor-pointer font-semibold"
          >
            {isPending && (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            )}
            {t("save")}
          </Button>
        </div>
      )}

      <PlayerModal
        player={selected ?? null}
        open={modalOpen && !swapMode}
        onOpenChange={(open) => {
          if (!open) clearSelection();
        }}
        isStarter={selectedIsStarter}
        isCaptain={selectedId === captainId}
        isVice={selectedId === viceId}
        fixtureLabel={selected ? fixtureLabel(selected) : undefined}
        canEdit={!locked}
        breakdown={selected ? breakdownFor(selected) : undefined}
        totalPoints={selected ? (pointsByPlayer[selected.id] ?? null) : null}
        onSwitch={() => {
          setModalOpen(false);
          setSwapMode(true);
        }}
        onMakeCaptain={() => assignRole("captain")}
        onMakeVice={() => assignRole("vice")}
      />
    </div>
  );
}
