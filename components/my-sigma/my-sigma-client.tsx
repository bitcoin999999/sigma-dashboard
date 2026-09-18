"use client";

import { useWatchlist, saveWatchlist } from "@/hooks/use-watchlist";
import { normalizeSymbols, WATCHLIST_LIMIT } from "@/lib/watchlist";
import { tickerDirectory } from "@/lib/ticker-search";

import * as React from "react";

import { Check, Copy, Plus, Search, X } from "lucide-react";

import { useLocale } from "@/components/locale-provider";
import { ExploreNav } from "@/components/layout/explore-nav";
import { NavBar } from "@/components/layout/nav-bar";
import { Section } from "@/components/layout/section";
import { SiteFooter } from "@/components/layout/site-footer";
import { DataBasis } from "@/components/dashboard/data-basis";
import { StockCard } from "@/components/dashboard/stock-card";
import { StockDetailPanel } from "@/components/dashboard/stock-detail-panel";
import { GRID, StockGridSkeleton } from "@/components/dashboard/stock-grid";
import { Input } from "@/components/ui/input";
import type { MarketSnapshot, StockData } from "@/lib/types";
import { cn } from "@/lib/utils";

const SHARE_PARAM = "s";
const SUGGESTION_LIMIT = 8;

interface MySigmaClientProps {
  /** Every symbol in the current snapshot — the universe you can pick from. */
  stocks: StockData[];
  snapshot: MarketSnapshot;
  sharedSymbols?: string;
}

export function MySigmaClient({ stocks, snapshot, sharedSymbols = "" }: MySigmaClientProps) {
  const { pick } = useLocale();
  const bySymbol = React.useMemo(
    () => new Map(stocks.map((stock) => [stock.symbol, stock])),
    [stocks],
  );

  const saved = useWatchlist();
  // The page keys this component by the share query, so a new shared URL is a new draft.
  const [sharedList, setSharedList] = React.useState<string[] | null>(() => {
    const incoming = normalizeSymbols(sharedSymbols.split(","), new Set(bySymbol.keys()));
    return incoming.length ? incoming : null;
  });
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const ready = saved.ready;
  const symbols = sharedList ?? saved.symbols;
  const shared = sharedList !== null;
  const update = (next: string[]) => {
    if (shared) setSharedList(next);
    else saveWatchlist(next);
  };
  const add = (symbol: string) => {
    if (!ready || symbols.includes(symbol) || symbols.length >= WATCHLIST_LIMIT) return;
    update([...symbols, symbol]); setQuery("");
  };
  const remove = (symbol: string) => update(symbols.filter((item) => item !== symbol));
  const save = () => { saveWatchlist(symbols); setSharedList(null); };

  const watchlist = React.useMemo(
    () =>
      symbols
        .map((symbol) => bySymbol.get(symbol))
        .filter((stock): stock is StockData => stock !== undefined),
    [symbols, bySymbol],
  );

  const suggestions = React.useMemo(() => {
    const needle = query.trim().toUpperCase();
    if (!needle) return [];

    return stocks
      .filter((stock) => !symbols.includes(stock.symbol))
      .filter(
        (stock) =>
          stock.symbol.includes(needle) ||
          stock.name.toUpperCase().includes(needle),
      )
      .slice(0, SUGGESTION_LIMIT);
  }, [query, stocks, symbols]);

  const shareUrl = ready
    ? `${window.location.origin}/my-sigma?${SHARE_PARAM}=${symbols.join(",")}`
    : "";

  const copyShareUrl = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused outright. The field beside the button
      // holds the same URL, so there is always a way to take it by hand.
    }
  }, [shareUrl]);

  const selectedStock = selected ? (bySymbol.get(selected) ?? null) : null;
  const full = symbols.length >= WATCHLIST_LIMIT;

  return (
    <>
      <NavBar
        tickers={tickerDirectory(stocks)}
        snapshot={snapshot}
        updatedAt={snapshot.updatedAt}
        sections={false}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-10 pb-4 sm:px-6 sm:pt-14 lg:px-8">
        <div className="max-w-2xl">
          <p className="label-xs">{pick("개인 워치리스트 · 이 브라우저에만 저장", "Personal watchlist · this browser only")}</p>
          <h1 className="mt-3 font-heading text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
            <span className="text-gradient">My Sigma</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {pick(`보드에서 최대 ${WATCHLIST_LIMIT}개 종목을 이 기기에 저장합니다. 계정이나 로그인은 필요 없으며, 아래 공유 링크를 사용할 때만 목록이 외부로 전달됩니다.`, `Up to ${WATCHLIST_LIMIT} symbols from the board, kept on this device. No account, no sign-in — the list lives in your browser, and the share link below is the only way it leaves it.`)}
          </p>
        </div>

        {!saved.persistent && <p role="status" className="mt-3 text-sm text-muted-foreground">{pick("브라우저 저장을 사용할 수 없어 이번 방문에만 유지됩니다.", "Storage unavailable; kept for this visit only.")}</p>}
        {ready && symbols.filter((symbol) => !bySymbol.has(symbol)).map((symbol) => <div key={symbol} className="mt-3 flex items-center gap-3 text-sm"><span>{symbol} · {pick("현재 데이터 없음 · 저장 유지", "Unavailable · still saved")}</span><button type="button" className="min-h-11 rounded-lg border px-3" onClick={() => remove(symbol)}>{pick("관심 해제", "Remove")}</button></div>)}
        <ExploreNav sessionDate={snapshot.sessionDate} className="mt-7" />

        <DataBasis snapshot={snapshot} className="mt-7 max-w-4xl" />

        <div className="mt-10 space-y-10">
          <Section
            eyebrow={pick("종목 추가", "Add symbols")}
            title={pick("보드 검색", "Search the board")}
            description={pick("티커나 회사명을 입력하세요. 현재 스냅샷에 있는 종목만 추가할 수 있습니다.", "Type a ticker or a company name. Only symbols in the current snapshot can be added.")}
            action={
              <span className="num text-xs text-muted-foreground">
                {pick(`${WATCHLIST_LIMIT}개 중 ${symbols.length}개`, `${symbols.length} of ${WATCHLIST_LIMIT}`)}
              </span>
            }
          >
            <div className="max-w-xl space-y-3">
              <div className="relative">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  disabled={full || !ready}
                  placeholder={
                    full
                      ? pick("워치리스트가 가득 찼습니다 — 추가하려면 하나를 삭제하세요", "Watchlist full — remove one to add another")
                      : "NVDA, Nvidia, Palantir…"
                  }
                  aria-label={pick("추가할 종목 검색", "Search symbols to add")}
                  className="h-11 pl-9 text-base"
                />
              </div>

              {suggestions.length > 0 && (
                <ul className="glass divide-y divide-border/40 overflow-hidden">
                  {suggestions.map((stock) => (
                    <li key={stock.symbol}>
                      <button
                        type="button"
                        onClick={() => add(stock.symbol)}
                        className="flex min-h-11 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                      >
                        <span className="num w-16 shrink-0 text-[13px] font-semibold">
                          {stock.symbol}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                          {stock.name}
                        </span>
                        <Plus
                          aria-hidden
                          className="size-3.5 shrink-0 text-muted-foreground"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {query.trim() && suggestions.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {pick(`보드에 “${query.trim()}”와 일치하는 종목이 없습니다.`, `Nothing on the board matches “${query.trim()}”.`)}
                </p>
              )}
            </div>
          </Section>

          <Section
            eyebrow={pick("워치리스트", "Watchlist")}
            title={pick("내 종목", "Your symbols")}
            description={pick("각 카드는 메인 보드와 같은 주간 σ 밴드를 사용합니다. 모바일에서 종목을 누르면 전체 차트가 열립니다.", "Each card sits on the same weekly σ band as the main board. Select one on mobile to open its full chart.")}
          >
            {shared && (
              <div className="glass mb-4 flex flex-wrap items-center justify-between gap-3 p-3.5">
                <p className="text-xs text-muted-foreground">
                  {pick("공유받은 목록을 보고 있습니다. 저장하기 전까지 수정사항은 이 페이지에만 남으며, 저장하면 이 브라우저의 워치리스트를 대체합니다.", "You are viewing a shared list. Edits stay on this page until you save — saving replaces the watchlist stored in this browser.")}
                </p>
                <button
                  type="button"
                  onClick={save}
                  className="min-h-11 shrink-0 rounded-full border border-border/80 px-3 py-1.5 text-xs font-medium transition-colors hover:border-border hover:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {pick("이 브라우저에 저장", "Save to this browser")}
                </button>
              </div>
            )}

            {!ready ? (
              <StockGridSkeleton count={3} />
            ) : watchlist.length === 0 ? (
              <div className="glass flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <p className="text-sm font-medium">{pick("아직 종목이 없습니다", "No symbols yet")}</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  {pick(`위에서 검색해 최대 ${WATCHLIST_LIMIT}개 종목을 추가하세요. 이 기기에서 다시 페이지를 열어도 그대로 유지됩니다.`, `Search above to add up to ${WATCHLIST_LIMIT} names. They will still be here the next time you open this page on this device.`)}
                </p>
              </div>
            ) : (
              <div className={GRID}>
                {watchlist.map((stock) => (
                  // Keep the remove control beside the card so the detail link
                  // and the destructive action remain independent targets.
                  <div key={stock.symbol} className="group/row relative">
                    <StockCard stock={stock} onSelect={setSelected} showWatch={false} />
                    <button
                      type="button"
                      onClick={() => remove(stock.symbol)}
                      aria-label={pick(`My Sigma에서 ${stock.symbol} 삭제`, `Remove ${stock.symbol} from My Sigma`)}
                      // Sits on the corner rather than inside it: the card's own
                      // top-right already carries the status badge.
                      className="absolute -top-2 -right-2 z-10 flex size-11 md:size-7 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-md:opacity-100"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {ready && watchlist.length > 0 && (
            <Section
              eyebrow={pick("공유", "Share")}
              title={pick("이 목록 공유하기", "Send this list to someone")}
              description={pick("링크에는 티커만 담깁니다. 링크를 연 사람은 자신의 보드에서 같은 종목을 보게 됩니다.", "The link carries the tickers only. Whoever opens it sees the same symbols on their own copy of the board.")}
            >
              <div className="flex max-w-2xl flex-wrap items-center gap-2">
                <Input
                  readOnly
                  value={shareUrl}
                  aria-label={pick("공유 URL", "Share URL")}
                  onFocus={(event) => event.currentTarget.select()}
                  className="num h-11 min-w-0 flex-1 text-xs"
                />
                <button
                  type="button"
                  onClick={copyShareUrl}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-xs font-medium transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    copied
                      ? "border-up/50 text-up"
                      : "border-border/80 hover:border-border hover:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)]",
                  )}
                >
                  {copied ? (
                    <Check className="size-3.5" aria-hidden />
                  ) : (
                    <Copy className="size-3.5" aria-hidden />
                  )}
                  {copied ? pick("복사됨", "Copied") : pick("링크 복사", "Copy link")}
                </button>
              </div>
            </Section>
          )}
        </div>
      </main>

      <SiteFooter snapshot={snapshot} />

      <StockDetailPanel
        stock={selectedStock}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </>
  );
}
