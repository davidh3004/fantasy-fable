import { Separator } from "@/components/ui/separator";

export function OrSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <Separator className="flex-1" />
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <Separator className="flex-1" />
    </div>
  );
}
