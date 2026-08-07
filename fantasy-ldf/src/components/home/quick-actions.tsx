import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowLeftRight,
  CalendarDays,
  Shirt,
  Trophy,
  type LucideIcon,
} from "lucide-react";

/**
 * Shortcuts to the four places a manager actually goes.
 *
 * Matches earns a tile despite the bottom nav not carrying it — it's otherwise
 * only reachable via More.
 */
const ACTIONS: Array<{
  key: string;
  href: string;
  Icon: LucideIcon;
  tone: string;
}> = [
  { key: "team", href: "/team", Icon: Shirt, tone: "bg-primary/15 text-primary" },
  {
    key: "transfers",
    href: "/transfers",
    Icon: ArrowLeftRight,
    tone: "bg-cyan-400/15 text-cyan-300",
  },
  {
    key: "matches",
    href: "/matches",
    Icon: CalendarDays,
    tone: "bg-emerald-400/15 text-emerald-300",
  },
  {
    key: "leagues",
    href: "/leagues",
    Icon: Trophy,
    tone: "bg-amber-400/15 text-amber-300",
  },
];

export async function QuickActions() {
  const t = await getTranslations("home.actions");

  return (
    <section>
      <h2 className="mb-2.5 font-heading text-base">{t("title")}</h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {ACTIONS.map(({ key, href, Icon, tone }) => (
          <Link
            key={key}
            href={href}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3 transition-all hover:-translate-y-px hover:border-primary/50"
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tone}`}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="truncate text-sm font-semibold">{t(key)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
