import { cn } from "@/lib/utils";

type ClubBadgeProps = {
  shortName: string;
  name?: string;
  color: string | null;
  badgeUrl?: string | null;
  className?: string;
};

/** Club crest: badge image when set, otherwise a color circle with initials. */
export function ClubCrest({
  shortName,
  name,
  color,
  badgeUrl,
  className,
}: ClubBadgeProps) {
  if (badgeUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={badgeUrl}
        alt={name ?? ""}
        referrerPolicy="no-referrer"
        className={cn("size-7 shrink-0 rounded-full object-contain", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white",
        className
      )}
      style={{ backgroundColor: color ?? "#7c3aed" }}
      aria-hidden
    >
      {shortName}
    </span>
  );
}
