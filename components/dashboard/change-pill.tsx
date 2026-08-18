import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ChangePillProps {
  value: number;
  className?: string;
  showIcon?: boolean;
}

export function ChangePill({
  value,
  className,
  showIcon = true,
}: ChangePillProps) {
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;

  return (
    <span
      className={cn(
        "num inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
        value > 0 && "bg-up/10 text-up",
        value < 0 && "bg-down/10 text-down",
        value === 0 && "bg-muted text-muted-foreground",
        className,
      )}
    >
      {showIcon && <Icon className="size-3" aria-hidden />}
      {formatPercent(value)}
    </span>
  );
}
