"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteAccount } from "@/app/(app)/more/actions";

/**
 * Deleting is irreversible and takes a squad, a season of points and any
 * league you own with it, so it asks for the word to be typed rather than for
 * a click. A confirm dialog you can dismiss by reflex is the wrong shape for
 * an action with no undo.
 */
export function DeleteAccountButton({ confirmWord }: { confirmWord: string }) {
  const t = useTranslations("more.deleteAccount");
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [isPending, startTransition] = useTransition();

  const matches = typed.trim().toUpperCase() === confirmWord.toUpperCase();

  function confirm() {
    if (!matches) return;
    startTransition(async () => {
      const result = await deleteAccount();
      // Success redirects, so reaching here at all means it failed.
      if (result?.error) toast.error(t("failed"));
    });
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-11 w-full cursor-pointer border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-4" aria-hidden />
        {t("trigger")}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setTyped("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("body")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delete-confirm">
              {t("confirmLabel", { word: confirmWord })}
            </Label>
            <Input
              id="delete-confirm"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className="h-11"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="h-11 cursor-pointer"
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirm}
              disabled={!matches || isPending}
              className="h-11 cursor-pointer"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4" aria-hidden />
              )}
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
