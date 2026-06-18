"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, RotateCcw, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BottomSheetContent } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { PitchView } from "@/components/pitch/pitch-view";
import { PlayerChip, ClubBadge } from "@/components/pitch/player-chip";
import { MarketSheet, type MarketCandidate } from "./market-sheet";
import { ReviewSheet } from "./review-sheet";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/game/format";
import { makeTransfers } from "@/app/(app)/transfers/actions";
import {
  applyTransfersToSquad,
  bankAfterTransfers,
  transferCost,
  validateTransferBatch,
  type TransferPair,
} from "@/lib/game/transfers";
import {
  POSITION_ORDER,
  type Position,
  type SquadSettings,
} from "@/lib/game/squad";
import type { MarketPlayer } from "@/lib/game/queries";
import type { OpponentInfo } from "@/components/team/lineup-editor";

type Sheet = "player" | "market" | "review" | null;

type TransfersEditorProps = {
  squad: MarketPlayer[]; // current confirmed squad (15)
  allPlayers: MarketPlayer[]; // entire market
  settings: SquadSettings;
  hitCost: number;
  freeTransfers: number;
  bank: number; // tenths
  preSeason: boolean;
  locked: boolean;
  opponents: Record<string, OpponentInfo>;
};

export function TransfersEditor({
  squad,
  allPlayers,
  settings,
  hitCost,
  freeTransfers,
  bank,
  preSeason,
  locked,
  opponents,
}: TransfersEditorProps) {
  const t = useTranslations("transfers");
  const tTeam = useTranslations("team");
  const router = useRouter();

  const [pairs, setPairs] = useState<TransferPair[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const byId = useMemo(
    () => new Map(allPlayers.map((p) => [p.id, p])),
    [allPlayers]
  );

  const displaySquad = useMemo(
    () => applyTransfersToSquad(squad, pairs, byId) ?? squad,
    [squad, pairs, byId]
  );
  const displayIds = useMemo(
    () => new Set(displaySquad.map((p) => p.id)),
    [displaySquad]
  );
  const outIds = useMemo(
    () => new Set(pairs.map((p) => p.outId)),
    [pairs]
  );
  const inIds = useMemo(() => new Set(pairs.map((p) => p.inId)), [pairs]);

  const groups = useMemo(() => {
    const result: Record<Position, MarketPlayer[]> = {
      GK: [],
      DEF: [],
      MID: [],
      FWD: [],
    };
    for (const player of displaySquad) result[player.position].push(player);
    for (const pos of POSITION_ORDER) {
      result[pos].sort((a, b) => b.price - a.price);
    }
    return result;
  }, [displaySquad]);

  const selected = selectedId ? byId.get(selectedId) : null;
  const bankPreview = bankAfterTransfers(bank, pairs, byId);
  const cost = transferCost({
    count: pairs.length,
    freeTransfers,
    hitCost,
    preSeason,
  });
  const freeLeft = preSeason
    ? null
    : Math.max(freeTransfers - pairs.length, 0);

  function fixtureLabel(player: MarketPlayer): string | undefined {
    const info = opponents[player.clubId];
    if (!info) return undefined;
    return tTeam(info.home ? "fixtureHome" : "fixtureAway", { opp: info.opp });
  }

  function clearSelection() {
    setSelectedId(null);
    setSheet(null);
  }

  function handleTap(id: string) {
    if (locked) return;
    setSelectedId(id);
    setSheet("player");
  }

  /** Market candidates for the selected player's position. */
  const candidates: MarketCandidate[] = useMemo(() => {
    if (!selected) return [];
    return allPlayers
      .filter(
        (p) =>
          p.position === selected.position &&
          !displayIds.has(p.id) &&
          !outIds.has(p.id)
      )
      .sort((a, b) => b.price - a.price)
      .map((player) => ({
        player,
        block: validateTransferBatch({
          squad,
          pairs: [...pairs, { outId: selected.id, inId: player.id }],
          poolById: byId,
          bank,
          settings,
        }),
      }));
  }, [selected, allPlayers, displayIds, outIds, pairs, squad, byId, bank, settings]);

  function handlePick(inId: string) {
    if (!selectedId) return;
    setPairs((prev) => [...prev, { outId: selectedId, inId }]);
    clearSelection();
  }

  function handleUndo() {
    if (!selectedId) return;
    setPairs((prev) => prev.filter((p) => p.inId !== selectedId));
    clearSelection();
  }

  function handleConfirm() {
    setServerError(undefined);
    startTransition(async () => {
      const result = await makeTransfers({ pairs });
      if (result.error) {
        setServerError(result.error);
        return;
      }
      setPairs([]);
      clearSelection();
      toast.success(t("saved"));
      router.refresh();
    });
  }

  const reviewPairs = pairs.map((pair) => ({
    out: byId.get(pair.outId)!,
    in: byId.get(pair.inId)!,
  }));

  const stats = [
    { key: "bank", value: formatMoney(bankPreview) },
    {
      key: "freeTransfers",
      value: freeLeft === null ? t("unlimited") : String(freeLeft),
    },
    {
      key: "pointsCost",
      value: cost.points > 0 ? `-${cost.points}` : "0",
      highlight: cost.points > 0,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Stats */}
      <section className="grid grid-cols-3 gap-2.5">
        {stats.map(({ key, value, highlight }) => (
          <div
            key={key}
            className="rounded-xl border border-border bg-card px-3 py-2.5"
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t(`stats.${key}`)}
            </p>
            <p
              className={cn(
                "mt-0.5 font-heading text-xl tabular-nums",
                key === "bank" &&
                  (bankPreview < 0 ? "text-cta" : "text-emerald-300"),
                highlight && "text-cta"
              )}
            >
              {value}
            </p>
          </div>
        ))}
      </section>

      <PitchView
        groups={groups}
        renderPlayer={(player) => (
          <span key={player.id} className="relative inline-flex">
            {inIds.has(player.id) && (
              <span
                className="absolute -top-1.5 -left-1 z-[2] flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow"
                aria-hidden
              >
                <ArrowLeftRight className="size-3" />
              </span>
            )}
            <PlayerChip
              player={player}
              caption={fixtureLabel(player) ?? formatMoney(player.price)}
              selected={selectedId === player.id}
              disabled={locked}
              onClick={() => handleTap(player.id)}
            />
          </span>
        )}
      />

      {/* Pending bar */}
      {pairs.length > 0 && !locked && (
        <div className="sticky bottom-20 z-30 flex items-center gap-2 rounded-xl border border-border bg-background/95 p-2.5 backdrop-blur lg:bottom-4">
          <p className="px-1.5 text-sm font-medium tabular-nums">
            {t("pending", { count: pairs.length })}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPairs([])}
            disabled={isPending}
            className="h-11 cursor-pointer"
          >
            <RotateCcw className="size-4" aria-hidden />
            {t("reset")}
          </Button>
          <Button
            type="button"
            onClick={() => setSheet("review")}
            disabled={isPending}
            className="h-11 flex-1 cursor-pointer font-semibold"
          >
            {t("reviewCta")}
          </Button>
        </div>
      )}

      {/* Player action sheet */}
      <Dialog
        open={sheet === "player" && selected != null}
        onOpenChange={(open) => {
          if (!open) clearSelection();
        }}
      >
        <BottomSheetContent>
          {selected && (
            <div className="flex flex-col gap-4 p-4 pt-6">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <ClubBadge player={selected} className="size-9 text-[10px]" />
                  <div className="min-w-0">
                    <DialogTitle className="truncate text-lg">
                      {selected.firstName} {selected.lastName}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      {selected.clubName} · {formatMoney(selected.price)}
                      {fixtureLabel(selected)
                        ? ` · ${fixtureLabel(selected)}`
                        : ""}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              {inIds.has(selected.id) ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUndo}
                  className="h-12 w-full cursor-pointer font-semibold"
                >
                  <Undo2 className="size-4" aria-hidden />
                  {t("undo")}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => setSheet("market")}
                  className="h-12 w-full cursor-pointer font-semibold"
                >
                  <ArrowLeftRight className="size-4" aria-hidden />
                  {t("transferOut")}
                </Button>
              )}
            </div>
          )}
        </BottomSheetContent>
      </Dialog>

      <MarketSheet
        open={sheet === "market" && selected != null}
        onOpenChange={(open) => {
          if (!open) clearSelection();
        }}
        position={selected?.position ?? null}
        outgoing={selected ?? null}
        available={bankPreview + (selected?.price ?? 0)}
        candidates={candidates}
        fixtureLabel={fixtureLabel}
        onPick={handlePick}
      />

      <ReviewSheet
        open={sheet === "review"}
        onOpenChange={(open) => {
          if (!open) setSheet(null);
        }}
        pairs={reviewPairs}
        cost={cost}
        preSeason={preSeason}
        bankAfter={bankPreview}
        errorMessage={
          serverError ? t(`errors.${serverError}`) : undefined
        }
        isPending={isPending}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
