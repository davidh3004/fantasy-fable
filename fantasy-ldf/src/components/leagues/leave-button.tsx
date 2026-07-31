"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { leaveLeague } from "@/app/(app)/leagues/actions";

export function LeaveLeagueButton({
  leagueId,
  leagueName,
}: {
  leagueId: string;
  leagueName: string;
}) {
  const t = useTranslations("leagues");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLeave() {
    startTransition(async () => {
      const result = await leaveLeague(leagueId);
      if (result.error) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      toast.success(t("leftToast"));
      router.push("/leagues");
    });
  }

  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="outline"
          disabled={isPending}
          className="h-10 cursor-pointer text-destructive hover:text-destructive"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <LogOut className="size-4" aria-hidden />
          )}
          {t("leave")}
        </Button>
      }
      title={t("confirmLeave", { name: leagueName })}
      description={t("leaveBody")}
      confirmLabel={t("leave")}
      cancelLabel={tCommon("cancel")}
      onConfirm={handleLeave}
    />
  );
}
