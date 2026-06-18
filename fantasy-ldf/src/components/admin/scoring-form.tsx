"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthAlert } from "@/components/auth/auth-alert";
import { saveScoringRules } from "@/app/(app)/admin/actions";
import type { Position } from "@/lib/game/squad";

export type ScoringRuleItem = {
  id: string;
  eventKey: string;
  position: Position | null;
  points: number;
};

/** Display order for the rule list. */
const EVENT_ORDER = [
  "minutes_lt_60",
  "minutes_gte_60",
  "goal",
  "assist",
  "clean_sheet",
  "saves_per_3",
  "penalty_save",
  "penalty_miss",
  "goals_conceded_per_2",
  "yellow_card",
  "red_card",
  "own_goal",
];

export function ScoringForm({ rules }: { rules: ScoringRuleItem[] }) {
  const t = useTranslations("admin.scoring");
  const tCommon = useTranslations("admin.common");
  const tPos = useTranslations("positionsShort");
  const [state, formAction, isPending] = useActionState(saveScoringRules, {});

  useEffect(() => {
    if (state.success) toast.success(tCommon("saved"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const sorted = [...rules].sort((a, b) => {
    const eventDiff =
      EVENT_ORDER.indexOf(a.eventKey) - EVENT_ORDER.indexOf(b.eventKey);
    if (eventDiff !== 0) return eventDiff;
    return (a.position ?? "").localeCompare(b.position ?? "");
  });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      {state.error && (
        <AuthAlert variant="error" message={tCommon(`errors.${state.error}`)} />
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full border-collapse bg-card text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3.5 py-2.5 font-medium">{t("event")}</th>
              <th className="px-3.5 py-2.5 font-medium">{t("position")}</th>
              <th className="px-3.5 py-2.5 text-right font-medium">
                {t("points")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((rule) => (
              <tr
                key={rule.id}
                className="border-b border-border/50 last:border-0"
              >
                <td className="px-3.5 py-2">{t(`events.${rule.eventKey}`)}</td>
                <td className="px-3.5 py-2 text-muted-foreground">
                  {rule.position ? tPos(rule.position) : t("allPositions")}
                </td>
                <td className="px-3.5 py-2 text-right">
                  <Input
                    name={`rule-${rule.id}`}
                    type="number"
                    min="-50"
                    max="50"
                    defaultValue={rule.points}
                    aria-label={`${t(`events.${rule.eventKey}`)} ${
                      rule.position ?? ""
                    }`}
                    className="ml-auto h-9 w-20 text-right tabular-nums"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="h-12 cursor-pointer font-semibold sm:w-auto sm:px-10"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Save className="size-4" aria-hidden />
        )}
        {tCommon("save")}
      </Button>
    </form>
  );
}
