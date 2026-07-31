"use client";

import { cloneElement, useState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConfirmDialogProps = {
  /** The clickable element that opens the dialog (e.g. a Button). */
  trigger: ReactElement;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** Red confirm button (default). Set false for a neutral primary action. */
  destructive?: boolean;
};

/**
 * Branded confirm popup. Replaces window.confirm(), which some in-app and
 * preview browsers silently suppress (making "nothing happen" on tap).
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  destructive = true,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {cloneElement(trigger as ReactElement<{ onClick?: () => void }>, {
        onClick: () => setOpen(true),
      })}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
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
              {cancelLabel}
            </DialogClose>
            <Button
              type="button"
              variant={destructive ? "destructive" : "default"}
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
              className="h-11 w-full cursor-pointer font-semibold sm:w-auto"
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
