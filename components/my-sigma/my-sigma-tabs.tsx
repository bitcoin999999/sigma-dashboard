"use client";

import Link from "next/link";

import { useLocale } from "@/components/locale-provider";
import { usePortfolio } from "@/hooks/use-portfolio";
import { useWatchlist } from "@/hooks/use-watchlist";
import { cn } from "@/lib/utils";

/** The watchlist and the portfolio are two views of "my symbols", one tap apart. */
export function MySigmaTabs({ current, className }: { current: "watchlist" | "portfolio"; className?: string }) {
  const { pick } = useLocale();
  const watchlist = useWatchlist();
  const portfolio = usePortfolio();
  const tabs = [
    { key: "watchlist", href: "/my-sigma", label: pick("관심종목", "Watchlist"), count: watchlist.ready ? watchlist.symbols.length : null },
    { key: "portfolio", href: "/my-sigma/portfolio", label: pick("포트폴리오", "Portfolio"), count: portfolio.ready ? portfolio.value.positions.length : null },
  ] as const;

  return (
    <nav aria-label={pick("My Sigma 보기", "My Sigma views")} className={cn("inline-flex rounded-xl border border-border p-1", className)}>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          prefetch={false}
          aria-current={current === tab.key ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            current === tab.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
          {tab.count !== null && <span className="num text-xs opacity-65">{tab.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
