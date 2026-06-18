"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Plus, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BottomSheetContent } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthAlert } from "@/components/auth/auth-alert";
import { createLeague, joinLeague } from "@/app/(app)/leagues/actions";

export function LeagueActions() {
  const t = useTranslations("leagues");
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [joinError, setJoinError] = useState<string>();
  const [creating, startCreate] = useTransition();
  const [joining, startJoin] = useTransition();

  function handleCreate(formData: FormData) {
    startCreate(async () => {
      const result = await createLeague({}, formData);
      if (result.code) {
        setCreateError(undefined);
        setCreatedCode(result.code);
        router.refresh();
      } else {
        setCreateError(result.error ?? "unknown");
      }
    });
  }

  function handleJoin(formData: FormData) {
    startJoin(async () => {
      const result = await joinLeague({}, formData);
      if (result.leagueId && !result.error) {
        setJoinOpen(false);
        toast.success(t("joinedToast"));
        router.push(`/leagues/${result.leagueId}`);
      } else {
        setJoinError(result.error ?? "unknown");
      }
    });
  }

  async function copyCode() {
    if (!createdCode) return;
    await navigator.clipboard.writeText(createdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function closeCreate() {
    setCreateOpen(false);
    setCreatedCode(null);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <Button
          onClick={() => {
            setCreateError(undefined);
            setCreateOpen(true);
          }}
          className="h-11 cursor-pointer font-semibold"
        >
          <Plus className="size-4" aria-hidden />
          {t("create")}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setJoinError(undefined);
            setJoinOpen(true);
          }}
          className="h-11 cursor-pointer font-semibold"
        >
          <UserPlus className="size-4" aria-hidden />
          {t("join")}
        </Button>
      </div>

      {/* Create */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => (open ? setCreateOpen(true) : closeCreate())}
      >
        <BottomSheetContent>
          <div className="flex flex-col gap-4 p-4 pt-6">
            <DialogHeader>
              <DialogTitle className="text-lg">{t("createTitle")}</DialogTitle>
            </DialogHeader>

            {createdCode ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  {t("createdHint")}
                </p>
                <button
                  type="button"
                  onClick={copyCode}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3"
                >
                  <span className="font-heading text-2xl tracking-[0.2em]">
                    {createdCode}
                  </span>
                  {copied ? (
                    <Check className="size-5 text-emerald-300" aria-hidden />
                  ) : (
                    <Copy className="size-5 text-muted-foreground" aria-hidden />
                  )}
                </button>
                <Button
                  onClick={closeCreate}
                  className="h-11 cursor-pointer font-semibold"
                >
                  {t("done")}
                </Button>
              </div>
            ) : (
              <form action={handleCreate} className="flex flex-col gap-3.5">
                {createError && (
                  <AuthAlert
                    variant="error"
                    message={t(`errors.${createError}`)}
                  />
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="league-name">{t("nameLabel")}</Label>
                  <Input
                    id="league-name"
                    name="name"
                    maxLength={40}
                    required
                    placeholder={t("namePlaceholder")}
                    className="h-11"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={creating}
                  className="h-11 cursor-pointer font-semibold"
                >
                  {creating && (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  )}
                  {t("create")}
                </Button>
              </form>
            )}
          </div>
        </BottomSheetContent>
      </Dialog>

      {/* Join */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <BottomSheetContent>
          <div className="flex flex-col gap-4 p-4 pt-6">
            <DialogHeader>
              <DialogTitle className="text-lg">{t("joinTitle")}</DialogTitle>
            </DialogHeader>
            <form action={handleJoin} className="flex flex-col gap-3.5">
              {joinError && (
                <AuthAlert variant="error" message={t(`errors.${joinError}`)} />
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="join-code">{t("codeLabel")}</Label>
                <Input
                  id="join-code"
                  name="code"
                  maxLength={8}
                  required
                  autoCapitalize="characters"
                  placeholder="ABC123"
                  className="h-11 uppercase tracking-[0.2em]"
                />
              </div>
              <Button
                type="submit"
                disabled={joining}
                className="h-11 cursor-pointer font-semibold"
              >
                {joining && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                {t("join")}
              </Button>
            </form>
          </div>
        </BottomSheetContent>
      </Dialog>
    </>
  );
}
