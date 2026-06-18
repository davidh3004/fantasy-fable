import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthAlertProps = {
  variant: "error" | "success";
  message: string;
};

export function AuthAlert({ variant, message }: AuthAlertProps) {
  const Icon = variant === "error" ? CircleAlert : CircleCheck;

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm",
        variant === "error"
          ? "border-destructive/40 bg-destructive/10 text-red-300"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
