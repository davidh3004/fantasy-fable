import { cn } from "@/lib/utils";

/**
 * Round player headshot with a silhouette fallback.
 *
 * Photos are hotlinked from the source feed, so `no-referrer` keeps them from
 * 403-ing, and `object-top` stops the crop from cutting off faces on portrait
 * source images.
 */
export function PlayerAvatar({
  photoUrl,
  className,
}: {
  photoUrl: string | null;
  className?: string;
}) {
  const base = "size-10 shrink-0 rounded-full border border-border";

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        referrerPolicy="no-referrer"
        className={cn(base, "bg-muted object-cover object-top", className)}
      />
    );
  }

  return (
    <span
      className={cn(base, "flex items-center justify-center bg-muted", className)}
      aria-hidden
    >
      <svg
        viewBox="0 0 40 40"
        className="size-2/3 text-muted-foreground"
        fill="currentColor"
      >
        <circle cx="20" cy="14" r="7" />
        <path d="M6 40c0-9 6.5-14 14-14s14 5 14 14z" />
      </svg>
    </span>
  );
}
