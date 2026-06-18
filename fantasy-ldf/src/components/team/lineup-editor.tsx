"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Loader2, RotateCcw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthAlert } from "@/components/auth/auth-alert";
import { PitchView } from "@/components/pitch/pitch-view";
import { PlayerChip } from "@/components/pitch/player-chip";
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
}: LineupEditorProps) {
  const t = useTranslations("team");
  const tPos = useTranslations("positionsShort");

  const [lineup, setLineup] = useState(initialLineup);
  const [captainId, setCaptainId] = useState(initialCaptainId);
  const [viceId, setViceId] = useState(initialViceId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [swapMode, setSwapMode] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [isPending, startTransition] = useTransition();

  // FLIP animation bookkeeping: chip elements by player id + their rects
  // captured right before a lineup change.
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());
  const prevRects = useRef<Map<string, DOMRect> | null>(null);

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

  useLayoutEffect(() => {
    const prev = prevRects.current;
    prevRects.current = null;
    if (!prev) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    for (const [id, el] of chipRefs.current) {
      const before = prev.get(id);
      if (!before) continue;
      const after = el.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)`, zIndex: "10" },
          { transform: "translate(0, 0)", zIndex: "10" },
        ],
        { duration: 350, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      );
    }
  }, [lineup]);

  function snapshotRects() {
    prevRects.current = new Map(
      [...chipRefs.current].map(([id, el]) => [id, el.getBoundingClientRect()])
    );
  }

  function registerChip(id: string) {
    return (el: HTMLButtonElement | null) => {
      if (el) chipRefs.current.set(id, el);
      else chipRefs.current.delete(id);
    };
  }

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
    if (locked) return;
    setMessage(null);

    if (!swapMode) {
      setSelectedId(id);
      setModalOpen(true);
      return;
    }

    // Swap mode: selectedId is fixed, this tap picks the swap target.
    if (id === selectedId) {
      clearSelection();
      return;
    }
    const result = trySwap(lineup, selectedId!, id, byId, settings);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    if (result.state) {
      snapshotRects();
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
    snapshotRects();
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

  function caption(player: MarketPlayer): string {
    const points = pointsByPlayer[player.id];
    if (points != null) return t("points", { points });
    return fixtureLabel(player) ?? tPos(player.position);
  }

  function chip(player: MarketPlayer, benchOrder?: number) {
    return (
      <PlayerChip
        key={player.id}
        ref={registerChip(player.id)}
        player={player}
        caption={caption(player)}
        selected={selectedId === player.id}
        dimmed={isDimmed(player.id)}
        captain={player.id === captainId}
        vice={player.id === viceId}
        benchOrder={benchOrder}
        disabled={locked}
        onClick={() => handleTap(player.id)}
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
        open={modalOpen && !swapMode && !locked}
        onOpenChange={(open) => {
          if (!open) clearSelection();
        }}
        isStarter={selectedIsStarter}
        isCaptain={selectedId === captainId}
        isVice={selectedId === viceId}
        fixtureLabel={selected ? fixtureLabel(selected) : undefined}
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
