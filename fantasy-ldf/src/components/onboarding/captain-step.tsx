"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AuthAlert } from "@/components/auth/auth-alert";
import { PitchView } from "@/components/pitch/pitch-view";
import { PlayerChip } from "@/components/pitch/player-chip";
import { cn } from "@/lib/utils";
import { POSITION_ORDER, type Position } from "@/lib/game/squad";
import type { MarketPlayer } from "@/lib/game/queries";

type CaptainStepProps = {
  players: MarketPlayer[]; // the picked 15
  starterIds: string[];
  captainId: string;
  viceId: string;
  onChange: (captainId: string, viceId: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  isPending: boolean;
  errorMessage?: string;
};

export function CaptainStep({
  players,
  starterIds,
  captainId,
  viceId,
  onChange,
  onBack,
  onSubmit,
  isPending,
  errorMessage,
}: CaptainStepProps) {
  const t = useTranslations("onboarding.captain");
  const tCommon = useTranslations("onboarding");
  const tPos = useTranslations("positionsShort");
  const [mode, setMode] = useState<"captain" | "vice">("captain");

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
    for (const id of starterIds) {
      const player = byId.get(id);
      if (player) result[player.position].push(player);
    }
    for (const pos of POSITION_ORDER) {
      result[pos].sort((a, b) => b.price - a.price);
    }
    return result;
  }, [starterIds, byId]);

  function handleTap(id: string) {
    if (mode === "captain") {
      // Assigning the current vice as captain swaps the two roles.
      onChange(id, id === viceId ? captainId : viceId);
      setMode("vice");
    } else {
      onChange(id === captainId ? viceId : captainId, id);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div>
        <h2 className="font-heading text-2xl">{t("title")}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("hint")}</p>
      </div>

      {errorMessage && <AuthAlert variant="error" message={errorMessage} />}

      {/* Mode toggle */}
      <div
        className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1"
        role="tablist"
        aria-label={t("title")}
      >
        {(["captain", "vice"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors",
              mode === m
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                m === "captain"
                  ? "bg-yellow-400 text-yellow-950"
                  : "bg-slate-200 text-slate-800"
              )}
              aria-hidden
            >
              {m === "captain" ? "C" : "V"}
            </span>
            {t(m === "captain" ? "modeCaptain" : "modeVice")}
          </button>
        ))}
      </div>

      <PitchView
        animateEntrance
        groups={groups}
        renderPlayer={(player) => (
          <PlayerChip
            key={player.id}
            player={player}
            caption={tPos(player.position)}
            captain={player.id === captainId}
            vice={player.id === viceId}
            onClick={() => handleTap(player.id)}
          />
        )}
      />

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
          onClick={onSubmit}
          disabled={isPending}
          className="h-11 flex-1 cursor-pointer font-semibold sm:ml-auto sm:max-w-xs sm:flex-none sm:px-10"
        >
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {t("finish")}
        </Button>
      </div>
    </div>
  );
}
