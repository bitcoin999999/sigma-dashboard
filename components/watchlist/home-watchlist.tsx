"use client";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { useWatchlist } from "@/hooks/use-watchlist";
import { formatSigma } from "@/lib/format";
import { WATCHLIST_LIMIT } from "@/lib/watchlist";
import type { StockData } from "@/lib/types";

export function HomeWatchlist({ stocks }: { stocks: StockData[] }) {
  const { pick } = useLocale();
  const { symbols, ready, persistent } = useWatchlist();
  const selected = symbols.map((symbol) => stocks.find((stock) => stock.symbol === symbol)).filter((stock): stock is StockData => !!stock);
  // The page masthead used to live here. It moved up to the benchmark block,
  // which now opens the phone, so this section is only the saved names.
  return <section className="order-3 mt-9 md:hidden" aria-label={pick("내 Sigma", "My Sigma")}>
    <div className="flex items-center justify-between"><h2 className="text-xl font-semibold tracking-tight">My Sigma <span className="text-sm font-normal text-muted-foreground">{ready && `${symbols.length}/${WATCHLIST_LIMIT}`}</span></h2><Link prefetch={false} href="/my-sigma" className="inline-flex min-h-11 items-center text-xs underline underline-offset-4">{pick("관리", "Manage")}</Link></div>
    <p className="mt-1 mb-3 text-xs text-muted-foreground">{pick("관심 종목의 이번 주 밴드 위치입니다.", "Where your saved symbols sit in this week’s band.")}</p>
    {!ready ? <p className="text-xs text-muted-foreground">{pick("관심 목록 확인 중…", "Loading your watchlist…")}</p> : symbols.length === 0 ? <p className="text-sm text-muted-foreground">{pick("관심 종목 3개를 추가해 보세요. 목록의 ☆를 누르면 저장됩니다.", "Start with 3 symbols. Tap ☆ in the list to save them.")}</p> : <>
      <div className="flex gap-2 overflow-x-auto pb-2">{selected.map((stock) => <Link prefetch={false} href={`/symbol/${stock.symbol}`} key={stock.symbol} className="num flex min-h-11 shrink-0 items-center gap-3 rounded-xl border border-border/70 px-3 text-sm"><strong>{stock.symbol}</strong><span>{formatSigma(stock.zScore)}</span></Link>)}</div>
      {selected.length < symbols.length && <p className="text-xs text-muted-foreground">{pick(`${symbols.length - selected.length}개는 현재 데이터가 없습니다. 저장 목록은 유지됩니다.`, `${symbols.length - selected.length} unavailable; saved symbols are retained.`)}</p>}
    </>}
    {symbols.length === WATCHLIST_LIMIT && <p className="mt-2 text-xs text-muted-foreground">{pick(`${WATCHLIST_LIMIT}개를 모두 저장했습니다. 새 종목을 추가하려면 관심을 하나 해제하세요.`, `All ${WATCHLIST_LIMIT} slots are used. Remove a symbol to add another.`)}</p>}
    {!persistent && <p role="status" className="mt-2 text-xs text-muted-foreground">{pick("브라우저 저장을 사용할 수 없어 이번 방문에만 유지됩니다.", "Storage unavailable; kept for this visit only.")}</p>}
  </section>;
}
