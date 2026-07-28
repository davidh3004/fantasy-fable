"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Sign-out control with a branded confirm dialog (works on all screens). */
export function SignOutButton() {
  const t = useTranslations("more");
  const tAuth = useTranslations("auth");

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full cursor-pointer text-destructive hover:text-destructive sm:w-auto"
          />
        }
      >
        <LogOut className="size-4" aria-hidden />
        {tAuth("signOut")}
      </DialogTrigger>

      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("signOutTitle")}</DialogTitle>
          <DialogDescription>{t("signOutBody")}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose
            render={
              <Button
                type="button"
                variant="ghost"
                className="h-11 w-full cursor-pointer sm:w-auto"
              />
            }
          >
            {t("cancel")}
          </DialogClose>
          <form action={signOut} className="contents">
            <Button
              type="submit"
              variant="destructive"
              className="h-11 w-full cursor-pointer font-semibold sm:w-auto"
            >
              <LogOut className="size-4" aria-hidden />
              {tAuth("signOut")}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
