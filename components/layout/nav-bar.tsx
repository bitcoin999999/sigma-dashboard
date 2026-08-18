"use client";

import { RefreshCw } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { useActiveSection } from "@/hooks/use-active-section";
import type { MarketSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

const LINKS = [
  { id: "market", label: "Market" },
  { id: "watchlist", label: "Watchlist" },
  { id: "sectors", label: "Sectors" },
];

const SESSION_LABEL: Record<MarketSnapshot["session"], string> = {
  PRE: "Pre-market",
  OPEN: "Market open",
  AFTER: "After hours",
  CLOSED: "Market closed",
};

interface NavBarProps {
  snapshot: MarketSnapshot;
  updatedAt: string;
  onRefresh: () => void;
  refreshing: boolean;
}

export function NavBar({
  snapshot,
  updatedAt,
  onRefresh,
  refreshing,
}: NavBarProps) {
  const active = useActiveSection(LINKS.map((link) => link.id));
  const isOpen = snapshot.session === "OPEN";

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/45">
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <a
          href="#top"
          className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <span className="num flex size-7 items-center justify-center rounded-[10px] bg-[linear-gradient(140deg,var(--primary),color-mix(in_oklch,var(--sigma-lower)_75%,var(--primary)))] text-[13px] font-semibold text-primary-foreground shadow-[0_6px_18px_-8px_var(--primary)]">
            σ
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.02em]">
            1SIGMA
          </span>
        </a>

        <nav
          aria-label="Sections"
          className="hidden flex-1 justify-center md:flex"
        >
          <ul className="flex items-center gap-1">
            {LINKS.map((link) => (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  aria-current={active === link.id ? "true" : undefined}
                  className={cn(
                    "relative rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    active === link.id
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {link.label}
                  {active === link.id && (
                    <span
                      aria-hidden
                      className="absolute inset-x-3 -bottom-px h-px bg-[linear-gradient(90deg,transparent,var(--primary),transparent)]"
                    />
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <span className="hidden items-center gap-2 rounded-full border border-border/70 py-1 pr-3 pl-2.5 sm:flex">
            <span className="relative flex size-1.5">
              {isOpen && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-up opacity-60" />
              )}
              <span
                className={cn(
                  "relative inline-flex size-1.5 rounded-full",
                  isOpen ? "bg-up" : "bg-muted-foreground",
                )}
              />
            </span>
            <span className="text-[11px] font-medium whitespace-nowrap">
              {SESSION_LABEL[snapshot.session]}
            </span>
          </span>

          <span className="num hidden text-[11px] whitespace-nowrap text-muted-foreground lg:inline">
            Updated {updatedAt}
          </span>

          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh quotes"
            className="flex size-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-border hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
          >
            <RefreshCw
              className={cn("size-3.5", refreshing && "animate-spin")}
              aria-hidden
            />
          </button>

          <ThemeToggle />
        </div>
      </div>

      <nav
        aria-label="Sections"
        className="flex items-center gap-1 border-t border-border/50 px-4 py-1.5 md:hidden"
      >
        {LINKS.map((link) => (
          <a
            key={link.id}
            href={`#${link.id}`}
            aria-current={active === link.id ? "true" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              active === link.id
                ? "bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)] text-foreground"
                : "text-muted-foreground",
            )}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
