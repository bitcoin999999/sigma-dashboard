"use client";

import { Star } from "lucide-react";
import { useId } from "react";
import { useLocale } from "@/components/locale-provider";
import { toggleWatchlist, useWatchlist } from "@/hooks/use-watchlist";
import { WATCHLIST_LIMIT } from "@/lib/watchlist";
import { cn } from "@/lib/utils";

export function WatchButton({ symbol, compact = false }: { symbol: string; compact?: boolean }) {
  const { pick } = useLocale();
  const list = useWatchlist();
  const id = useId();
  const saved = list.symbols.includes(symbol);
  const full = !saved && list.symbols.length >= WATCHLIST_LIMIT;
  const label = saved ? pick(`${symbol} 관심 해제`, `Remove ${symbol} from watchlist`) : pick(`${symbol} 관심 추가`, `Add ${symbol} to watchlist`);
  const hint = full ? pick(`관심 종목은 최대 ${WATCHLIST_LIMIT}개입니다. My Sigma에서 하나를 삭제하세요.`, `Limit of ${WATCHLIST_LIMIT} symbols. Remove one in My Sigma.`) : !list.persistent ? pick("브라우저 저장을 사용할 수 없어 이번 방문에만 유지됩니다.", "Storage unavailable; kept for this visit only.") : "";
  // One star per row means the hint would otherwise be a live region on every
  // row, each announcing the same sentence the moment the tenth name is saved.
  // Compact stars fold it into their own label and render nothing.
  return <span className="inline-flex flex-col items-start">
    <button type="button" aria-label={hint && compact ? `${label}. ${hint}` : label} aria-pressed={saved} aria-describedby={hint && !compact ? id : undefined}
      // `aria-disabled` rather than `disabled`, so a full list leaves 60-odd
      // stars explaining why instead of 60-odd dead controls.
      aria-disabled={full || undefined} disabled={!list.ready} title={hint || label}
      onClick={(event) => { event.stopPropagation(); if (!full) toggleWatchlist(symbol); }}
      className={cn("inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/90 px-3 text-xs focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50",
        compact && "border-0 bg-transparent px-0 text-muted-foreground/70",
        saved && "text-primary", full && "opacity-40")}>
      <Star className="size-4" fill={saved ? "currentColor" : "none"} aria-hidden />
      {!compact && (saved ? pick("관심 등록됨", "Saved") : pick("관심 추가", "Watch"))}
    </button>
    {hint && !compact && <span id={id} role="status" className="mt-1 max-w-64 text-xs text-muted-foreground">{hint}</span>}
  </span>;
}
