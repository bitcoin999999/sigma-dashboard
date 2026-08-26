"use client";

import * as React from "react";

import { Check, Copy, Plus, Search, X } from "lucide-react";

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

const STORAGE_KEY = "sigma-personal-watchlist";
const WATCHLIST_LIMIT = 10;
const SHARE_PARAM = "s";
/** Search results shown at once. Long enough to browse, short enough to scan. */
const SUGGESTION_LIMIT = 8;

/**
 * Cleans an untrusted list of tickers into something safe to render.
 *
 * Both inputs are untrusted in the same way: a share URL is typed by whoever
 * sends it, and `localStorage` outlives the board — a list saved a month ago
 * can name symbols the publisher has since dropped. Anything not currently in
 * the snapshot is discarded rather than rendered as a blank card.
 */
function normalizeSymbols(values: string[], valid: Set<string>): string[] {
  const seen = new Set<string>();

  for (const value of values) {
    if (typeof value !== "string") continue;
    const symbol = value.trim().toUpperCase();
    if (!symbol || seen.has(symbol) || !valid.has(symbol)) continue;
    seen.add(symbol);
    if (seen.size >= WATCHLIST_LIMIT) break;
  }

  return [...seen];
}

function readStoredSymbols(valid: Set<string>): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return normalizeSymbols(parsed as string[], valid);
  } catch {
    // Corrupt JSON, a value written by something else, or storage blocked
    // outright. None of those are worth taking the page down for.
    return [];
  }
}

function writeStoredSymbols(symbols: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  } catch {
    // Private browsing or a full quota. The list still works for this visit.
  }
}

function readSharedSymbols(valid: Set<string>): string[] {
  const raw = new URLSearchParams(window.location.search).get(SHARE_PARAM);
  if (!raw) return [];
  return normalizeSymbols(raw.split(","), valid);
}

interface Watchlist {
  symbols: string[];
  /**
   * The list came in over a share link and has not been written to this
   * browser yet. Kept separate from "empty" so a visitor opening someone
   * else's link never silently overwrites their own saved watchlist.
   */
  shared: boolean;
}

/** Stable identity, so the empty case does not re-trigger every memo below. */
const NO_SYMBOLS: string[] = [];

const noSubscribe = () => () => {};

/**
 * False on the server and through hydration, true on every render after.
 *
 * Neither `localStorage` nor the URL is readable while rendering on the
 * server, and reading them during hydration would make the first client render
 * disagree with the markup it is adopting. This says when it is safe to look.
 */
function useHydrated(): boolean {
  return React.useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

interface MySigmaClientProps {
  /** Every symbol in the current snapshot — the universe you can pick from. */
  stocks: StockData[];
  snapshot: MarketSnapshot;
}

export function MySigmaClient({ stocks, snapshot }: MySigmaClientProps) {
  const bySymbol = React.useMemo(
    () => new Map(stocks.map((stock) => [stock.symbol, stock])),
    [stocks],
  );

  const hydrated = useHydrated();
  /** Set on the first edit, from which point it is the list. */
  const [edited, setEdited] = React.useState<Watchlist | null>(null);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // A share link wins over storage: following someone's link and landing on
  // your own watchlist would be the wrong answer to an explicit request.
  const stored = React.useMemo<Watchlist | null>(() => {
    if (!hydrated) return null;

    const valid = new Set(bySymbol.keys());
    const fromUrl = readSharedSymbols(valid);

    return fromUrl.length > 0
      ? { symbols: fromUrl, shared: true }
      : { symbols: readStoredSymbols(valid), shared: false };
  }, [hydrated, bySymbol]);

  const list = edited ?? stored;
  /** Nothing is readable until hydration, so the first paint has no list. */
  const ready = list !== null;
  const symbols = list?.symbols ?? NO_SYMBOLS;
  const shared = list?.shared ?? false;

  /**
   * Applies an edit, and persists it unless the list is still someone else's.
   *
   * While `shared` is set the edit stays in memory: the visitor is looking at
   * a link, and only the explicit Save below is treated as consent to replace
   * whatever they had stored.
   */
  const update = React.useCallback(
    (next: string[]) => {
      setEdited({ symbols: next, shared });
      if (!shared) writeStoredSymbols(next);
    },
    [shared],
  );

  const add = React.useCallback(
    (symbol: string) => {
      if (symbols.includes(symbol) || symbols.length >= WATCHLIST_LIMIT) return;
      update([...symbols, symbol]);
      setQuery("");
    },
    [symbols, update],
  );

  const remove = React.useCallback(
    (symbol: string) => {
      update(symbols.filter((entry) => entry !== symbol));
    },
    [symbols, update],
  );

  const save = React.useCallback(() => {
    writeStoredSymbols(symbols);
    setEdited({ symbols, shared: false });
  }, [symbols]);

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
        snapshot={snapshot}
        updatedAt={snapshot.updatedAt}
        sections={false}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-10 pb-4 sm:px-6 sm:pt-14 lg:px-8">
        <div className="max-w-2xl">
          <p className="label-xs">Personal watchlist · this browser only</p>
          <h1 className="mt-3 font-heading text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
            <span className="text-gradient">My Sigma</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Up to {WATCHLIST_LIMIT} symbols from the board, kept on this device.
            No account, no sign-in — the list lives in your browser, and the
            share link below is the only way it leaves it.
          </p>
        </div>

        <DataBasis snapshot={snapshot} className="mt-7 max-w-4xl" />

        <div className="mt-10 space-y-10">
          <Section
            eyebrow="Add symbols"
            title="Search the board"
            description="Type a ticker or a company name. Only symbols in the current snapshot can be added."
            action={
              <span className="num text-xs text-muted-foreground">
                {symbols.length} of {WATCHLIST_LIMIT}
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
                  disabled={full}
                  placeholder={
                    full
                      ? "Watchlist full — remove one to add another"
                      : "NVDA, Nvidia, Palantir…"
                  }
                  aria-label="Search symbols to add"
                  className="h-10 pl-9"
                />
              </div>

              {suggestions.length > 0 && (
                <ul className="glass divide-y divide-border/40 overflow-hidden">
                  {suggestions.map((stock) => (
                    <li key={stock.symbol}>
                      <button
                        type="button"
                        onClick={() => add(stock.symbol)}
                        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
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
                  Nothing on the board matches “{query.trim()}”.
                </p>
              )}
            </div>
          </Section>

          <Section
            eyebrow="Watchlist"
            title="Your symbols"
            description="Each card sits on the same weekly σ band as the main board. Select one to open its detail panel."
          >
            {shared && (
              <div className="glass mb-4 flex flex-wrap items-center justify-between gap-3 p-3.5">
                <p className="text-xs text-muted-foreground">
                  You are viewing a shared list. Edits stay on this page until
                  you save — saving replaces the watchlist stored in this
                  browser.
                </p>
                <button
                  type="button"
                  onClick={save}
                  className="shrink-0 rounded-full border border-border/80 px-3 py-1.5 text-xs font-medium transition-colors hover:border-border hover:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Save to this browser
                </button>
              </div>
            )}

            {!ready ? (
              <StockGridSkeleton count={3} />
            ) : watchlist.length === 0 ? (
              <div className="glass flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <p className="text-sm font-medium">No symbols yet</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Search above to add up to {WATCHLIST_LIMIT} names. They will
                  still be here the next time you open this page on this device.
                </p>
              </div>
            ) : (
              <div className={GRID}>
                {watchlist.map((stock) => (
                  // The remove control is a sibling of the card, not a child:
                  // the card is itself a button, and nesting one button inside
                  // another is invalid HTML.
                  <div key={stock.symbol} className="group/row relative">
                    <StockCard stock={stock} onSelect={setSelected} />
                    <button
                      type="button"
                      onClick={() => remove(stock.symbol)}
                      aria-label={`Remove ${stock.symbol} from My Sigma`}
                      // Sits on the corner rather than inside it: the card's own
                      // top-right already carries the status badge.
                      className="absolute -top-2 -right-2 z-10 flex size-7 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-sm:opacity-100"
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
              eyebrow="Share"
              title="Send this list to someone"
              description="The link carries the tickers only. Whoever opens it sees the same symbols on their own copy of the board."
            >
              <div className="flex max-w-2xl flex-wrap items-center gap-2">
                <Input
                  readOnly
                  value={shareUrl}
                  aria-label="Share URL"
                  onFocus={(event) => event.currentTarget.select()}
                  className="num h-10 min-w-0 flex-1 text-xs"
                />
                <button
                  type="button"
                  onClick={copyShareUrl}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-xs font-medium transition-colors",
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
                  {copied ? "Copied" : "Copy link"}
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
