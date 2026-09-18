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
  const hint = full ? pick("관심 종목은 최대 10개입니다. My Sigma에서 하나를 삭제하세요.", "Limit of 10 symbols. Remove one in My Sigma.") : !list.persistent ? pick("브라우저 저장을 사용할 수 없어 이번 방문에만 유지됩니다.", "Storage unavailable; kept for this visit only.") : "";
  return <span className="inline-flex flex-col items-start">
    <button type="button" aria-label={label} aria-pressed={saved} aria-describedby={hint ? id : undefined}
      disabled={!list.ready || full} title={hint || label}
      onClick={(event) => { event.stopPropagation(); toggleWatchlist(symbol); }}
      className={cn("inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/90 px-3 text-xs focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50", saved && "text-primary", compact && "px-0")}>
      <Star className="size-4" fill={saved ? "currentColor" : "none"} aria-hidden />
      {!compact && (saved ? pick("관심 등록됨", "Saved") : pick("관심 추가", "Watch"))}
    </button>
    {hint && <span id={id} role="status" className={compact ? "sr-only" : "mt-1 max-w-64 text-xs text-muted-foreground"}>{hint}</span>}
  </span>;
}
