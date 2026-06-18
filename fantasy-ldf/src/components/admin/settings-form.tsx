"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthAlert } from "@/components/auth/auth-alert";
import { saveSettings } from "@/app/(app)/admin/actions";

export type SettingsValues = {
  budget: number;
  squadSize: number;
  gkCount: number;
  defCount: number;
  midCount: number;
  fwdCount: number;
  startingSize: number;
  minDef: number;
  minMid: number;
  minFwd: number;
  maxPerClub: number;
  freeTransfersPerGw: number;
  maxBankedTransfers: number;
  transferHitCost: number;
  deadlineOffsetMinutes: number;
  wildcardsPerSeason: number;
};

const GROUPS: Array<{ key: string; fields: Array<keyof SettingsValues> }> = [
  {
    key: "squad",
    fields: [
      "budget",
      "squadSize",
      "gkCount",
      "defCount",
      "midCount",
      "fwdCount",
      "maxPerClub",
    ],
  },
  {
    key: "lineup",
    fields: ["startingSize", "minDef", "minMid", "minFwd"],
  },
  {
    key: "transfers",
    fields: [
      "freeTransfersPerGw",
      "maxBankedTransfers",
      "transferHitCost",
      "wildcardsPerSeason",
    ],
  },
  {
    key: "schedule",
    fields: ["deadlineOffsetMinutes"],
  },
];

export function SettingsForm({ values }: { values: SettingsValues }) {
  const t = useTranslations("admin.settings");
  const tCommon = useTranslations("admin.common");
  const [state, formAction, isPending] = useActionState(saveSettings, {});

  useEffect(() => {
    if (state.success) toast.success(tCommon("saved"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error && (
        <AuthAlert variant="error" message={tCommon(`errors.${state.error}`)} />
      )}

      {GROUPS.map((group) => (
        <section
          key={group.key}
          className="rounded-xl border border-border bg-card p-4"
        >
          <h2 className="mb-3 font-heading text-base">
            {t(`groups.${group.key}`)}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {group.fields.map((field) => (
              <div key={field} className="flex flex-col gap-1.5">
                <Label htmlFor={`s-${field}`} className="text-xs">
                  {t(`fields.${field}`)}
                </Label>
                <Input
                  id={`s-${field}`}
                  name={field}
                  type="number"
                  min="0"
                  defaultValue={values[field]}
                  required
                  className="h-10 tabular-nums"
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs text-muted-foreground">{t("budgetHint")}</p>

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
