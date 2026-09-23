"use client";

import * as React from "react";
import { Plus, Search } from "lucide-react";

import { useLocale } from "@/components/locale-provider";
import { Input } from "@/components/ui/input";
import { parsePositionLines, POSITION_LIMIT, type Position } from "@/lib/portfolio";
import type { StockData } from "@/lib/types";

const SUGGESTION_LIMIT = 8;
const chip = "inline-flex min-h-11 items-center gap-1 rounded-full border border-border px-3 text-xs transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40";

export type AddSource = "search" | "watchlist" | "paste";

/**
 * Three ways in, cheapest first: one tap on a symbol already starred, a search
 * over the whole board, or a pasted list for someone moving a full account.
 */
export function AddPositions({
  stocks, held, watchlist, onAdd,
}: {
  stocks: StockData[]; held: ReadonlySet<string>; watchlist: string[];
  onAdd: (positions: Position[], source: AddSource) => void;
}) {
  const { pick } = useLocale();
  const [query, setQuery] = React.useState("");
  const [bulk, setBulk] = React.useState("");
  const [rejected, setRejected] = React.useState<string[]>([]);
  const full = held.size >= POSITION_LIMIT;
  const onBoard = React.useMemo(() => new Set(stocks.map((stock) => stock.symbol)), [stocks]);

  const suggestions = React.useMemo(() => {
    const needle = query.trim().toUpperCase();
    if (!needle) return [];
    const rank = (stock: StockData) => stock.symbol === needle ? 0 : stock.symbol.startsWith(needle) ? 1 : stock.symbol.includes(needle) ? 2 : 3;
    return stocks
      .filter((stock) => !held.has(stock.symbol) && (stock.symbol.includes(needle) || stock.name.toUpperCase().includes(needle)))
      .sort((a, b) => rank(a) - rank(b) || a.symbol.localeCompare(b.symbol))
      .slice(0, SUGGESTION_LIMIT);
  }, [query, stocks, held]);

  const quick = watchlist.filter((symbol) => !held.has(symbol) && onBoard.has(symbol));
  const unsized = (symbol: string): Position => ({ symbol, quantity: null, averageCost: null });
  const pickSuggestion = (symbol: string) => { onAdd([unsized(symbol)], "search"); setQuery(""); };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && suggestions[0]) { event.preventDefault(); pickSuggestion(suggestions[0].symbol); }
          }}
          disabled={full}
          placeholder={full ? pick(`최대 ${POSITION_LIMIT}개까지 담을 수 있습니다`, `Up to ${POSITION_LIMIT} holdings`) : pick("종목 추가 — 티커 또는 회사명", "Add a holding — ticker or company")}
          aria-label={pick("포트폴리오에 추가할 종목 검색", "Search a symbol to add to the portfolio")}
          className="h-11 pl-9 text-base"
        />
      </div>

      {suggestions.length > 0 && (
        <ul className="glass divide-y divide-border/40 overflow-hidden">
          {suggestions.map((stock) => (
            <li key={stock.symbol}>
              <button
                type="button"
                onClick={() => pickSuggestion(stock.symbol)}
                className="flex min-h-11 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
              >
                <span className="num w-16 shrink-0 text-[13px] font-semibold">{stock.symbol}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{stock.name}</span>
                <Plus aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && suggestions.length === 0 && (
        <p className="text-xs text-muted-foreground">{pick(`“${query.trim()}”와 일치하는 종목이 보드에 없거나 이미 담겨 있습니다.`, `Nothing on the board matches “${query.trim()}”, or it is already held.`)}</p>
      )}

      {quick.length > 0 && !full && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">{pick("관심종목에서", "From your watchlist")}</span>
          {quick.map((symbol) => (
            <button key={symbol} type="button" className={chip} aria-label={pick(`${symbol} 포트폴리오에 추가`, `Add ${symbol} to the portfolio`)} onClick={() => onAdd([unsized(symbol)], "watchlist")}>
              <Plus aria-hidden className="size-3" />{symbol}
            </button>
          ))}
          {quick.length > 1 && (
            <button type="button" className={`${chip} border-foreground/40 font-medium`} aria-label={pick(`관심종목 ${quick.length}개 모두 포트폴리오에 추가`, `Add all ${quick.length} watchlist symbols to the portfolio`)} onClick={() => onAdd(quick.map(unsized), "watchlist")}>
              {pick(`${quick.length}개 모두 추가`, `Add all ${quick.length}`)}
            </button>
          )}
        </div>
      )}

      <details className="group rounded-xl border border-border/60 px-4 py-1 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center text-muted-foreground">{pick("여러 종목 한 번에 입력", "Paste several at once")}</summary>
        <div className="space-y-3 pb-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {pick("한 줄에 한 종목씩 “티커 수량 평단”. 평단은 생략할 수 있고, 이미 담긴 종목은 수량이 바뀝니다.", "One per line: “ticker shares cost”. Cost is optional; a symbol already held gets the new size.")}
          </p>
          <textarea
            value={bulk}
            onChange={(event) => setBulk(event.target.value)}
            rows={4}
            spellCheck={false}
            autoCapitalize="characters"
            placeholder={"NVDA 10 180\nAAPL 5\nSOXX 3 520.5"}
            aria-label={pick("여러 종목 입력", "Several holdings")}
            className="num w-full rounded-lg border border-border bg-background px-3 py-2 text-base outline-offset-2 placeholder:text-muted-foreground/50 focus-visible:outline-2 focus-visible:outline-ring"
          />
          {rejected.length > 0 && (
            <p role="alert" className="text-xs text-down">
              {pick("읽지 못한 줄 (보드에 없는 티커이거나 숫자 형식 오류)", "Lines not read (not on the board, or not a number)")}: {rejected.join(" · ")}
            </p>
          )}
          <button
            type="button"
            disabled={!bulk.trim()}
            onClick={() => {
              const parsed = parsePositionLines(bulk, onBoard);
              setRejected(parsed.rejected);
              if (parsed.positions.length) onAdd(parsed.positions, "paste");
              // Leave only what still needs fixing in the box.
              setBulk(parsed.rejected.join("\n"));
            }}
            className="inline-flex min-h-11 items-center rounded-xl bg-foreground px-4 text-sm text-background disabled:opacity-40"
          >
            {pick("목록에 반영", "Apply to the list")}
          </button>
        </div>
      </details>
    </div>
  );
}
