import { STATUS_META, statusStyle } from "@/lib/sigma";
import type { SigmaStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: SigmaStatus;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({
  status,
  size = "sm",
  className,
}: StatusBadgeProps) {
  const meta = STATUS_META[status];
  const isExtreme = status === "OVERHEATED" || status === "OVERSOLD";

  return (
    <span
      style={statusStyle(status)}
      className={cn(
        "state-chip inline-flex items-center gap-1.5 rounded-full font-medium tracking-[0.04em] whitespace-nowrap tabular-nums",
        size === "sm" ? "h-5 px-2 text-[10px]" : "h-6 px-2.5 text-[11px]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full bg-[var(--state)]",
          isExtreme && "state-glow",
        )}
      />
      {meta.label}
    </span>
  );
}
