"use client";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { useWatchlist } from "@/hooks/use-watchlist";
import { StockCard } from "@/components/dashboard/stock-card";
import { GRID } from "@/components/dashboard/stock-grid";
import { WATCHLIST_LIMIT } from "@/lib/watchlist";
import { SigmaSummary } from "@/components/my-sigma/sigma-summary";
import type { MarketSnapshot, StockData } from "@/lib/types";

/** The home block is a preview; past this many the full list is a page away. */
const PREVIEW = 6;

export function HomeWatchlist({ stocks, snapshot }: { stocks: StockData[]; snapshot: MarketSnapshot }) {
  const { pick } = useLocale();
  const { symbols, ready, persistent } = useWatchlist();
  const selected = symbols.map((symbol) => stocks.find((stock) => stock.symbol === symbol)).filter((stock): stock is StockData => !!stock);
  const preview = selected.slice(0, PREVIEW);
  // The page masthead used to live here. It moved up to the benchmark block,
  // which now opens the phone, so this section is only the saved names.
  return <section className="order-5 mt-9" aria-label={pick("내 Sigma", "My Sigma")}>
    <div className="flex items-center justify-between"><h2 className="text-xl font-semibold tracking-tight">My Sigma <span className="text-sm font-normal text-muted-foreground">{ready && `${symbols.length}/${WATCHLIST_LIMIT}`}</span></h2><Link prefetch={false} href="/my-sigma" className="inline-flex min-h-11 items-center text-xs underline underline-offset-4">{pick("관리", "Manage")}</Link></div>
    <p className="mt-1 mb-3 text-xs text-muted-foreground">{pick("관심 종목의 이번 주 밴드 위치입니다.", "Where your saved symbols sit in this week’s band.")}</p>
    {ready && <div className="mb-3"><SigmaSummary symbols={symbols} stocks={stocks} snapshot={snapshot} compact/></div>}
    {!ready ? <p className="text-xs text-muted-foreground">{pick("관심 목록 확인 중…", "Loading your watchlist…")}</p> : symbols.length === 0 ? null : <>
      <div className={GRID}>{preview.map((stock) => <StockCard key={stock.symbol} stock={stock} href={`/symbol/${stock.symbol}`} />)}</div>
      {selected.length > preview.length && <Link prefetch={false} href="/my-sigma" className="mt-2 inline-flex min-h-11 items-center text-xs underline underline-offset-4">{pick(`나머지 ${selected.length - preview.length}개 보기`, `See ${selected.length - preview.length} more`)}</Link>}
      {selected.length < symbols.length && <p className="mt-2 text-xs text-muted-foreground">{pick(`${symbols.length - selected.length}개는 현재 데이터가 없습니다. 저장 목록은 유지됩니다.`, `${symbols.length - selected.length} unavailable; saved symbols are retained.`)}</p>}
    </>}
    {symbols.length === WATCHLIST_LIMIT && <p className="mt-2 text-xs text-muted-foreground">{pick(`${WATCHLIST_LIMIT}개를 모두 저장했습니다. 새 종목을 추가하려면 관심을 하나 해제하세요.`, `All ${WATCHLIST_LIMIT} slots are used. Remove a symbol to add another.`)}</p>}
    {!persistent && <p role="status" className="mt-2 text-xs text-muted-foreground">{pick("브라우저 저장을 사용할 수 없어 이번 방문에만 유지됩니다.", "Storage unavailable; kept for this visit only.")}</p>}
  </section>;
}
