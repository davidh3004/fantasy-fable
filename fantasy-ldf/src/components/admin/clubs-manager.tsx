"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthAlert } from "@/components/auth/auth-alert";
import { deleteClub, saveClub } from "@/app/(app)/admin/actions";

export type AdminClub = {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  badgeUrl: string | null;
  playerCount: number;
};

function Field({
  name,
  label,
  defaultValue,
  required = false,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`club-${name}`}>{label}</Label>
      <Input
        id={`club-${name}`}
        name={name}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        className="h-10"
      />
    </div>
  );
}

export function ClubsManager({ clubs }: { clubs: AdminClub[] }) {
  const t = useTranslations("admin.clubs");
  const tCommon = useTranslations("admin.common");
  const [editing, setEditing] = useState<AdminClub | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  // Handle the action result inline (no setState-in-effect): close + toast
  // on success, surface the error otherwise.
  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await saveClub({}, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setError(undefined);
        setDialogOpen(false);
        toast.success(tCommon("saved"));
      }
    });
  }

  function openCreate() {
    setEditing(null);
    setError(undefined);
    setDialogOpen(true);
  }

  function openEdit(club: AdminClub) {
    setEditing(club);
    setError(undefined);
    setDialogOpen(true);
  }

  function handleDelete(club: AdminClub) {
    if (!window.confirm(tCommon("confirmDelete", { name: club.name }))) return;
    startTransition(async () => {
      const result = await deleteClub(club.id);
      if (result.error) toast.error(tCommon(`errors.${result.error}`));
      else toast.success(tCommon("deleted"));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("count", { count: clubs.length })}
        </p>
        <Button onClick={openCreate} className="h-10 cursor-pointer">
          <Plus className="size-4" aria-hidden />
          {t("new")}
        </Button>
      </div>

      <ul className="flex flex-col gap-1.5">
        {clubs.map((club) => (
          <li
            key={club.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5"
          >
            {club.badgeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={club.badgeUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="size-9 shrink-0 rounded-full object-contain"
              />
            ) : (
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: club.primaryColor ?? "#7c3aed" }}
                aria-hidden
              >
                {club.shortName}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {club.name}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t("players", { count: club.playerCount })}
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openEdit(club)}
              aria-label={tCommon("edit")}
              className="cursor-pointer"
            >
              <Pencil className="size-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(club)}
              aria-label={tCommon("delete")}
              className="cursor-pointer text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t("editTitle") : t("new")}</DialogTitle>
          </DialogHeader>
          <form key={editing?.id ?? "new"} action={handleSubmit} className="flex flex-col gap-3.5">
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            {error && (
              <AuthAlert variant="error" message={tCommon(`errors.${error}`)} />
            )}
            <Field name="name" label={t("name")} defaultValue={editing?.name} required />
            <div className="grid grid-cols-2 gap-3">
              <Field
                name="shortName"
                label={t("shortName")}
                defaultValue={editing?.shortName}
                required
                placeholder="CIB"
              />
              <Field
                name="primaryColor"
                label={t("primaryColor")}
                defaultValue={editing?.primaryColor ?? ""}
                placeholder="#F58220"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                name="secondaryColor"
                label={t("secondaryColor")}
                defaultValue={editing?.secondaryColor ?? ""}
                placeholder="#000000"
              />
              <Field
                name="badgeUrl"
                label={t("badgeUrl")}
                defaultValue={editing?.badgeUrl ?? ""}
                placeholder="https://..."
              />
            </div>
            <div className="flex items-center gap-3">
              {editing?.badgeUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={editing.badgeUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="size-12 shrink-0 rounded-full border border-border object-contain"
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Label htmlFor="club-badgeFile">{tCommon("uploadImage")}</Label>
                <Input
                  id="club-badgeFile"
                  name="badgeFile"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="h-10 cursor-pointer pt-2 text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  {tCommon("uploadHint")}
                </p>
              </div>
            </div>
            <Button
              type="submit"
              disabled={isPending}
              className="mt-1 h-11 cursor-pointer font-semibold"
            >
              {isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              {tCommon("save")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
