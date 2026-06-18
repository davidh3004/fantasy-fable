"use client";

import { DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type BottomSheetContentProps = React.ComponentProps<typeof DialogContent>;

/** DialogContent styled as a bottom sheet (slides up from the bottom edge). */
export function BottomSheetContent({
  className,
  children,
  ...props
}: BottomSheetContentProps) {
  return (
    <DialogContent
      className={cn(
        "top-auto bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 translate-y-0 p-0 sm:max-w-md",
        "rounded-t-2xl rounded-b-none pb-[env(safe-area-inset-bottom)]",
        "duration-300 data-closed:duration-200",
        "data-open:zoom-in-100 data-closed:zoom-out-100",
        "data-open:slide-in-from-bottom-[100%] data-closed:slide-out-to-bottom-[100%]",
        className
      )}
      {...props}
    >
      {/* Sheet grab handle */}
      <span
        className="absolute top-2 left-1/2 z-[1] h-1 w-10 -translate-x-1/2 rounded-full bg-white/30"
        aria-hidden
      />
      {children}
    </DialogContent>
  );
}
