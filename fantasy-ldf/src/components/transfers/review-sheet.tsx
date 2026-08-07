"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BottomSheetContent } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { AuthAlert } from "@/components/auth/auth-alert";
import { PlayerAvatar } from "@/components/shared/player-avatar";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/game/format";
import type { MarketPlayer } from "@/lib/game/queries";
import type { TransferCost } from "@/lib/game/transfers";

export type ReviewPair = { out: MarketPlayer; in: MarketPlayer };

type ReviewSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pairs: ReviewPair[];
  cost: TransferCost;
  preSeason: boolean;
  bankAfter: number;
  errorMessage?: string;
  isPending: boolean;
  onConfirm: () => void;
};

function PlayerCell({ player }: { player: MarketPlayer }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      {/* The face identifies who you're moving faster than a crest does —
          the club is still named on the line below. */}
      <PlayerAvatar photoUrl={player.photoUrl} className="size-8" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">
          {player.lastName}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          <span className="font-medium">{player.clubShortName}</span>
          <span className="tabular-nums"> · {formatMoney(player.price)}</span>
        </span>
      </span>
    </span>
  );
}

export function ReviewSheet({
  open,
  onOpenChange,
  pairs,
  cost,
  preSeason,
  bankAfter,
  errorMessage,
  isPending,
  onConfirm,
}: ReviewSheetProps) {
  const t = useTranslations("transfers.review");

  const summary = [
    {
      key: "free",
      value: preSeason ? t("unlimited") : String(cost.freeUsed),
    },
    {
      key: "hits",
      value:
        cost.hits > 0
          ? t("hitsValue", { count: cost.hits, points: cost.points })
          : "0",
      highlight: cost.hits > 0,
    },
    { key: "bankAfter", value: formatMoney(bankAfter) },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent className="flex max-h-[85dvh] flex-col gap-0">
        <div className="p-4 pb-3">
          <DialogHeader>
            <DialogTitle className="text-lg">{t("title")}</DialogTitle>
          </DialogHeader>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
          {errorMessage && (
            <AuthAlert variant="error" message={errorMessage} />
          )}

          {/* Out → In pairs */}
          <ul className="flex flex-col gap-1.5">
            <li
              className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground"
              aria-hidden
            >
              <span className="flex-1">{t("out")}</span>
              <span className="w-4" />
              <span className="flex-1">{t("in")}</span>
            </li>
            {pairs.map((pair) => (
              <li
                key={pair.out.id}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5"
              >
                <PlayerCell player={pair.out} />
                <ArrowRight
                  className="size-4 shrink-0 text-cta"
                  aria-hidden
                />
                <PlayerCell player={pair.in} />
              </li>
            ))}
          </ul>

          {/* Summary */}
          <dl className="flex flex-col gap-1 rounded-xl border border-border bg-card px-3.5 py-3 text-sm">
            {summary.map(({ key, value, highlight }) => (
              <div key={key} className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t(key)}</dt>
                <dd
                  className={cn(
                    "font-semibold tabular-nums",
                    highlight && "text-cta"
                  )}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="h-12 w-full cursor-pointer font-semibold"
          >
            {isPending && (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            )}
            {t("confirm", { count: pairs.length })}
          </Button>
        </div>
      </BottomSheetContent>
    </Dialog>
  );
}
