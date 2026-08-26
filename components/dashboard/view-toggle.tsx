"use client";

import { LayoutGrid, List } from "lucide-react";

import type { ViewMode } from "@/lib/types";
import { cn } from "@/lib/utils";

const VIEWS: { key: ViewMode; label: string; Icon: typeof LayoutGrid }[] = [
  { key: "CARD", label: "Card view", Icon: LayoutGrid },
  { key: "LIST", label: "List view", Icon: List },
];

interface ViewToggleProps {
  value: ViewMode;
  onChange: (next: ViewMode) => void;
  className?: string;
}

/**
 * Cards or rows, in one control shared by the board and the screener pages.
 *
 * Icons alone, with the name carried by the accessible label: the two layouts
 * are self-evident from the glyphs, and spelling them out would take more width
 * than the controls next to it.
 */
export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="Watchlist layout"
      className={cn(
        "flex shrink-0 items-center gap-0.5 rounded-lg border border-border/70 p-0.5",
        className,
      )}
    >
      {VIEWS.map(({ key, label, Icon }) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={active}
            aria-label={label}
            title={label}
            className={cn(
              "flex size-7 cursor-pointer items-center justify-center rounded-[6px] transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
              active
                ? "bg-[color-mix(in_oklch,var(--foreground)_9%,transparent)] text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
