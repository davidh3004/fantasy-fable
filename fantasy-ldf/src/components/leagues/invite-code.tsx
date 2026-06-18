"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";

export function InviteCode({ code }: { code: string }) {
  const t = useTranslations("leagues");
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/50"
    >
      <span className="min-w-0">
        <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
          {t("inviteCode")}
        </span>
        <span className="block font-heading text-xl tracking-[0.2em]">
          {code}
        </span>
      </span>
      {copied ? (
        <span className="flex items-center gap-1.5 text-sm text-emerald-300">
          <Check className="size-4" aria-hidden />
          {t("copied")}
        </span>
      ) : (
        <Copy className="size-5 text-muted-foreground" aria-hidden />
      )}
    </button>
  );
}
