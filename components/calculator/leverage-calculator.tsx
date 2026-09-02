"use client";

import * as React from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

import { NavBar } from "@/components/layout/nav-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { Input } from "@/components/ui/input";
import {
  directionClass,
  formatCurrency,
  formatEastern,
  formatPercent,
  formatPrice,
} from "@/lib/format";
import {
  LEVERAGE_FAMILIES,
  formatMultiple,
  projectFundPrice,
} from "@/lib/leverage";
import type { LeverageFamily, LeveragedFund } from "@/lib/leverage";
import type { LiveQuote, LiveQuotes } from "@/lib/live-quotes";
import type { MarketSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Moves worth one tap. Symmetric, and wide enough to reach a 3× fund's day. */
const PRESETS = [-5, -3, -1, 1, 3, 5];

/**
 * Which field the reader last typed in.
 *
 * The price and the percentage are two views of one number, so exactly one of
 * them is the input and the other is rendered from it. Keeping the source
 * explicit is also what makes a refresh do the right thing: a typed *price* is
 * a level on the chart and must survive a new quote, while a typed *percentage*
 * is a move and must be re-priced off it.
 */
type Entry = { raw: string; source: "price" | "percent" };

const AT_SPOT: Entry = { raw: "0", source: "percent" };

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[,\s$%]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * "+$1.76" / "−$1.76", with a real minus sign to match the percentages.
 *
 * Always two decimals, unlike a price: this is a distance, and printing a
 * third digit on it only because the fund happens to trade under $10 lends the
 * figure a precision the projection does not have.
 */
function formatSignedCurrency(value: number): string {
  return `${value < 0 ? "−" : "+"}$${Math.abs(value).toFixed(2)}`;
}

interface LeverageCalculatorProps {
  snapshot: MarketSnapshot;
  /** Null when the quote feed was unreachable while rendering. */
  initialQuotes: LiveQuotes | null;
}

export function LeverageCalculator({
  snapshot,
  initialQuotes,
}: LeverageCalculatorProps) {
  const [quotes, setQuotes] = React.useState(initialQuotes);
  const [refreshing, setRefreshing] = React.useState(false);
  const [baseSymbol, setBaseSymbol] = React.useState(LEVERAGE_FAMILIES[0].base);
  const [entry, setEntry] = React.useState<Entry>(AT_SPOT);

  const family =
    LEVERAGE_FAMILIES.find((item) => item.base === baseSymbol) ??
    LEVERAGE_FAMILIES[0];
  const baseQuote = quotes?.quotes[family.base] ?? null;
  const basePrice = baseQuote?.price ?? null;

  const refresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/leverage", { cache: "no-store" });
      if (!response.ok) throw new Error(`Quotes returned ${response.status}`);
      setQuotes((await response.json()) as LiveQuotes);
    } catch (error) {
      console.error("Quote refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const typed = parseNumber(entry.raw);

  const movePercent =
    entry.source === "percent"
      ? typed
      : typed !== null && basePrice
        ? (typed / basePrice - 1) * 100
        : null;

  const targetPrice =
    entry.source === "price"
      ? typed
      : typed !== null && basePrice
        ? basePrice * (1 + typed / 100)
        : null;

  // Whichever field is not being typed in shows the derived value, formatted.
  // Rendering the typed one back through a formatter would fight the cursor.
  const priceField =
    entry.source === "price"
      ? entry.raw
      : targetPrice !== null
        ? formatPrice(targetPrice)
        : "";

  const percentField =
    entry.source === "percent"
      ? entry.raw
      : movePercent !== null
        ? movePercent.toFixed(2)
        : "";

  return (
    <>
      <NavBar
        snapshot={snapshot}
        updatedAt={snapshot.updatedAt}
        onRefresh={refresh}
        refreshing={refreshing}
        sections={false}
      />

      {/* Sized so a phone holds the whole tool at once — tabs, the input and
          every card — without a scroll between typing a level and reading the
          answer. Everything below drops a line or a label at the `sm` break
          rather than shrinking type. */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-4 pb-4 sm:px-6 sm:pt-14 lg:px-8">
        <div className="max-w-2xl">
          {/* The tab bar already says Calculator, so the eyebrow is the first
              thing to go when the phone needs the pixels. */}
          <p className="label-xs hidden sm:block">
            Leverage calculator · live prices
          </p>
          <h1 className="font-heading text-[1.3rem] leading-[1.15] font-semibold tracking-[-0.03em] text-balance sm:mt-3 sm:text-4xl">
            <span className="text-gradient">
              Chart the ETF, price the leverage.
            </span>
          </h1>
          <p className="mt-4 hidden text-sm leading-relaxed text-muted-foreground sm:block">
            Take a level off the plain fund you actually chart — QQQ at 700 —
            and read where its 2× and 3× cousins trade when it gets there.
            Leveraged funds track a daily <em>return</em>, not a price, so the
            move is applied to each fund&rsquo;s own last print rather than
            converted through a ratio.
          </p>
        </div>

        <div className="mt-4 space-y-4 sm:mt-10 sm:space-y-8">
          {quotes === null || baseQuote === null ? (
            <QuoteFeedDown onRetry={refresh} retrying={refreshing} />
          ) : (
            <>
              <FamilyTabs
                current={family.base}
                onSelect={(symbol) => {
                  setBaseSymbol(symbol);
                  // A level on the QQQ chart means nothing on the SPY chart.
                  setEntry(AT_SPOT);
                }}
              />

              <BasePanel
                family={family}
                quote={baseQuote}
                asOf={quotes.asOf}
                priceField={priceField}
                percentField={percentField}
                movePercent={movePercent}
                onPrice={(raw) => setEntry({ raw, source: "price" })}
                onPercent={(raw) => setEntry({ raw, source: "percent" })}
                onReset={() => setEntry(AT_SPOT)}
                refreshing={refreshing}
              />

              <section>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 sm:mb-4">
                  <h2 className="font-heading text-[15px] font-semibold tracking-[-0.02em] sm:text-xl">
                    Where {family.base}&rsquo;s ladder lands
                  </h2>
                  <p className="hidden text-[11px] text-muted-foreground sm:block sm:text-[13px]">
                    {movePercent === null ? (
                      "Enter a price or a move above."
                    ) : (
                      <>
                        Each fund carried by{" "}
                        <span className="num">
                          {formatPercent(movePercent)}
                        </span>{" "}
                        on {family.base}, times its multiple.
                      </>
                    )}
                  </p>
                </div>

                <div
                  className={cn(
                    "grid gap-2 transition-opacity duration-200 sm:gap-3",
                    // Two up on a phone, so a five-rung ladder is three rows
                    // rather than five screens.
                    family.funds.length > 1 ? "grid-cols-2" : "grid-cols-1",
                    "sm:grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))]",
                    refreshing && "opacity-70",
                  )}
                  // Caps how wide the cards can stretch, so a two-fund ladder
                  // like SOXX's reads as a pair rather than two banners.
                  style={{ maxWidth: `${family.funds.length * 22}rem` }}
                  aria-busy={refreshing}
                >
                  {family.funds.map((fund) => {
                    const quote = quotes.quotes[fund.symbol];
                    if (!quote) return null;
                    return (
                      <FundCard
                        key={fund.symbol}
                        fund={fund}
                        quote={quote}
                        movePercent={movePercent}
                      />
                    );
                  })}
                </div>

                <DailyResetNote />
              </section>
            </>
          )}
        </div>
      </main>

      <SiteFooter snapshot={snapshot} />
    </>
  );
}

function FamilyTabs({
  current,
  onSelect,
}: {
  current: string;
  onSelect: (symbol: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Base ETF"
      // One scrolling row on a phone rather than three wrapped ones: the
      // vertical space it saves is a whole row of cards.
      className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden"
    >
      {LEVERAGE_FAMILIES.map((family) => {
        const active = family.base === current;
        return (
          <button
            key={family.base}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(family.base)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-medium transition-colors sm:h-10 sm:px-4",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active
                ? "border-border bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)] text-foreground"
                : "border-border/80 text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            <span className="num font-semibold">{family.base}</span>
            <span className="hidden sm:inline">{family.index}</span>
          </button>
        );
      })}
    </div>
  );
}

interface BasePanelProps {
  family: LeverageFamily;
  quote: LiveQuote;
  asOf: string;
  priceField: string;
  percentField: string;
  movePercent: number | null;
  onPrice: (raw: string) => void;
  onPercent: (raw: string) => void;
  onReset: () => void;
  refreshing: boolean;
}

function BasePanel({
  family,
  quote,
  asOf,
  priceField,
  percentField,
  movePercent,
  onPrice,
  onPercent,
  onReset,
  refreshing,
}: BasePanelProps) {
  return (
    <div className="glass p-3.5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3 sm:gap-y-4">
        <div>
          <p className="label-xs">{family.index}</p>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:mt-2">
            <span className="num text-xl font-semibold">{family.base}</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {family.baseName}
            </span>
          </div>
        </div>

        <div className="text-right">
          {/* Without dropping the prefix, a four-figure base like SOXX pushes
              this onto its own line and the header grows a row. */}
          <p className="label-xs whitespace-nowrap">
            <span className="hidden sm:inline">Last price · </span>
            {formatEastern(asOf)}
          </p>
          <p
            className={cn(
              "num mt-1.5 text-xl font-semibold transition-opacity sm:mt-2",
              refreshing && "opacity-60",
            )}
          >
            {formatCurrency(quote.price)}
            <span
              className={cn(
                "ml-2 text-xs font-medium",
                directionClass(quote.changePercent),
              )}
            >
              {formatPercent(quote.changePercent)}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-6 sm:gap-5">
        <label className="block">
          <span className="label-xs">
            <span className="sm:hidden">{family.base} at</span>
            <span className="hidden sm:inline">If {family.base} trades at</span>
          </span>
          <span className="relative mt-1 block sm:mt-2">
            <span
              aria-hidden
              className="num pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base text-muted-foreground sm:left-3.5"
            >
              $
            </span>
            <Input
              value={priceField}
              onChange={(event) => onPrice(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              aria-label={`Target price for ${family.base}`}
              className="num h-11 pl-7 text-base font-semibold sm:h-12 sm:pl-8 sm:text-lg"
            />
          </span>
        </label>

        <label className="block">
          <span className="label-xs">
            <span className="sm:hidden">Move</span>
            <span className="hidden sm:inline">Which is a move of</span>
          </span>
          <span className="relative mt-1 block sm:mt-2">
            <Input
              value={percentField}
              onChange={(event) => onPercent(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              aria-label={`Move in percent for ${family.base}`}
              className={cn(
                "num h-11 pr-7 text-base font-semibold sm:h-12 sm:pr-8 sm:text-lg",
                movePercent !== null && directionClass(movePercent),
              )}
            />
            <span
              aria-hidden
              className="num pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-base text-muted-foreground sm:right-3.5"
            >
              %
            </span>
          </span>
        </label>
      </div>

      {/* One scrolling row on a phone: wrapping this costs a second line of
          height, which is the whole budget for a card below the fold. */}
      <div className="-mx-3.5 mt-2.5 flex items-center gap-1.5 overflow-x-auto px-3.5 [scrollbar-width:none] sm:mx-0 sm:mt-4 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onPercent(String(preset))}
            className="num inline-flex h-7 shrink-0 items-center rounded-full border border-border/80 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:h-8 sm:px-3"
          >
            {formatPercent(preset, 0)}
          </button>
        ))}
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-border/80 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:h-8 sm:px-3"
        >
          <RotateCcw className="size-3" aria-hidden />
          At spot
        </button>
      </div>
    </div>
  );
}

function FundCard({
  fund,
  quote,
  movePercent,
}: {
  fund: LeveragedFund;
  quote: LiveQuote;
  movePercent: number | null;
}) {
  const projected =
    movePercent === null
      ? null
      : projectFundPrice(quote.price, fund.multiple, movePercent);

  const change = movePercent === null ? null : fund.multiple * movePercent;
  const delta = projected === null ? null : projected - quote.price;
  /** A −34% day zeroes a 3× fund. Worth showing rather than clamping quietly. */
  const wipeout = projected !== null && projected <= 0;

  return (
    <div
      className="glass glass-interactive flex flex-col gap-2 p-2.5 sm:gap-4 sm:p-5"
      style={
        {
          "--state": fund.multiple > 0 ? "var(--up)" : "var(--down)",
        } as React.CSSProperties
      }
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <span className="num text-[15px] font-semibold">{fund.symbol}</span>
          {/* The issuer's full name is reference, not the answer — on a phone
              the answer has to win the space. */}
          <p className="mt-1 hidden truncate text-[11px] text-muted-foreground sm:block">
            {fund.name}
          </p>
        </div>
        <span className="num state-chip shrink-0 rounded-lg px-1.5 py-0.5 text-[11px] font-semibold sm:px-2 sm:py-1">
          {formatMultiple(fund.multiple)}
        </span>
      </div>

      <div>
        {/* The move rides beside the price on a phone and drops beneath it from
            `sm` up, which is a whole line of card height across the ladder. */}
        <div className="flex flex-wrap items-baseline gap-x-2 sm:block">
          <div className="num text-xl leading-none font-semibold tracking-tight sm:text-[2rem]">
            {projected === null
              ? "—"
              : wipeout
                ? "$0.00"
                : formatCurrency(projected)}
          </div>

          <div className="num flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs sm:mt-2.5">
            {change !== null && delta !== null ? (
              <>
                <span className={cn("font-medium", directionClass(change))}>
                  {formatPercent(change)}
                </span>
                <span className="hidden text-muted-foreground sm:inline">
                  {formatSignedCurrency(delta)}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Enter a level</span>
            )}
          </div>
        </div>

        {wipeout && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-down">
            <TriangleAlert className="size-3 shrink-0" aria-hidden />A move this
            large wipes the fund out.
          </p>
        )}
      </div>

      <div className="mt-auto flex items-baseline justify-between gap-2 border-t border-border/50 pt-1.5 text-[11px] sm:pt-3">
        <span className="text-muted-foreground">Now</span>
        <span className="num">
          {formatCurrency(quote.price)}
          <span className={cn("ml-2", directionClass(quote.changePercent))}>
            {formatPercent(quote.changePercent)}
          </span>
        </span>
      </div>
    </div>
  );
}

function DailyResetNote() {
  return (
    <p className="mt-4 max-w-3xl text-[11px] leading-relaxed text-muted-foreground sm:mt-5 sm:text-xs">
      These funds reset every day, so the figures above are exact for a single
      move off the prices they were read at and nothing more.
      <span className="hidden sm:inline">
        {" "}
        Held across sessions the multiple compounds: a round trip that leaves{" "}
        <span className="num">QQQ</span> flat still leaves a 3× fund lower, and
        the wider the swings on the way the larger that gap. Fees, borrowing
        cost and tracking error are not modelled here.
      </span>{" "}
      Not investment advice.
    </p>
  );
}

function QuoteFeedDown({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="glass flex flex-col items-start gap-4 p-6">
      <div className="flex items-center gap-2.5">
        <TriangleAlert className="size-4 text-down" aria-hidden />
        <p className="text-sm font-medium">Live quotes are unavailable.</p>
      </div>
      <p className="max-w-lg text-xs leading-relaxed text-muted-foreground">
        This page prices both legs off the same intraday feed, and it did not
        answer. Nothing is shown rather than a conversion built on stale prices,
        which would be wrong in exactly the way that costs money.
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-xs font-medium transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
      >
        <RotateCcw
          className={cn("size-3.5", retrying && "animate-spin")}
          aria-hidden
        />
        {retrying ? "Retrying…" : "Try again"}
      </button>
    </div>
  );
}
