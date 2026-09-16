import { easternDate, partsIn } from "./calendar-state";

export const BARS_PER_SESSION = 13;
export const WEEK_SLOTS = BARS_PER_SESSION * 5;

export interface WeeklyCandle {
  timestamp: number;
  date: string;
  time: string;
  slot: number;
  open: number;
  high: number;
  low: number;
  close: number;
  complete: boolean;
}

export interface WeeklyChartData {
  symbol: string;
  weekStart: string;
  weekEnd: string;
  dates: string[];
  candles: WeeklyCandle[];
  fetchedAt: string;
}

export interface WeeklyChartBand {
  weekStart: string;
  anchorDate: string;
  anchor: number;
  lower: number;
  upper: number;
  lower2?: number;
  upper2?: number;
}

/** Calendar week in market time. Keep the completed week through Sunday. */
export function chartWeek(now = new Date()) {
  const monday = new Date(`${easternDate(now)}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const dates = Array.from({ length: 5 }, (_, day) => {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + day);
    return date.toISOString().slice(0, 10);
  });
  return { weekStart: dates[0], weekEnd: dates[4], dates };
}

/** One locale-aware timestamp for candle readouts, hover labels and refresh time. */
export function chartTimeLabel(at: Date, locale: string): string {
  const p = partsIn(locale === "ko" ? "Asia/Seoul" : "America/New_York", at);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${two(p.month)}-${two(p.day)} ${two(p.hour)}:${two(p.minute)} ${locale === "ko" ? "KST" : "ET"}`;
}

export type ChartScaleMode = "normal" | "upper-breakout" | "lower-breakout";

export function chartScaleMode(lastClose: number | undefined, band?: WeeklyChartBand): ChartScaleMode {
  if (!band || !Number.isFinite(lastClose)) return "normal";
  if (lastClose! > band.upper) return "upper-breakout";
  if (lastClose! < band.lower) return "lower-breakout";
  return "normal";
}

/** `candles` reads the week's own range; `sigma` keeps ±1σ; `all` also pulls in the GEX strikes. */
export type AxisFit = "candles" | "sigma" | "all";

function padDomain(low: number, high: number): [number, number] {
  const padding = Math.max(high - low, high * 0.002) * 0.12;
  return [low - padding, high + padding];
}

function outsideBy(value: number, floor: number, ceiling: number): number {
  return value < floor ? floor - value : value > ceiling ? value - ceiling : 0;
}

export function bandSigmaPrices(band?: WeeklyChartBand): number[] {
  return [band?.lower, band?.upper, band?.lower2, band?.upper2]
    .filter((value): value is number => Number.isFinite(value));
}

/**
 * Candle readability comes first: a name whose week sits far from its anchor
 * would otherwise squeeze every bar into a sliver of a σ-wide axis. Only when
 * the week's own range leaves no σ line on screen does the axis stretch to the
 * nearest one, so the band is never entirely out of sight.
 */
export function candleDomain(candles: WeeklyCandle[], band?: WeeklyChartBand, extraPrices: number[] = [],
    fit: AxisFit = "candles"): [number, number] {
  if (!candles.length && !band && !extraPrices.length) return [0, 1];
  const extras = fit === "all" ? extraPrices : [];
  if (fit === "candles" && candles.length) {
    const low = Math.min(...candles.map((bar) => bar.low), ...extras);
    const high = Math.max(...candles.map((bar) => bar.high), ...extras);
    const [floor, ceiling] = padDomain(low, high);
    const sigmas = bandSigmaPrices(band);
    if (!sigmas.length || sigmas.some((value) => value >= floor && value <= ceiling)) return [floor, ceiling];
    // Ties go to the lower edge: a band breach downward is the alarming one.
    const nearest = sigmas.reduce((best, value) => {
      const gap = outsideBy(value, floor, ceiling), bestGap = outsideBy(best, floor, ceiling);
      return gap < bestGap || (gap === bestGap && value < best) ? value : best;
    });
    return padDomain(Math.min(low, nearest), Math.max(high, nearest));
  }
  const mode = chartScaleMode(candles.at(-1)?.close, band);
  const targetLow = mode === "lower-breakout" ? band?.lower2 ?? band?.lower :
    mode === "upper-breakout" ? band?.anchor ?? band?.lower : band?.lower;
  const targetHigh = mode === "upper-breakout" ? band?.upper2 ?? band?.upper :
    mode === "lower-breakout" ? band?.lower ?? band?.upper : band?.upper;
  const low = Math.min(...candles.map((bar) => bar.low), targetLow ?? Infinity, ...extras);
  const high = Math.max(...candles.map((bar) => bar.high), targetHigh ?? -Infinity, ...extras);
  return padDomain(low, high);
}

/** Round gridline prices, so the axis reads in steps a trader can do arithmetic on. */
export function priceTicks(floor: number, ceiling: number, target = 5): number[] {
  const span = ceiling - floor;
  if (!(span > 0)) return [];
  const rough = span / (target - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((value) => value >= rough) ?? magnitude * 10;
  const ticks: number[] = [];
  for (let value = Math.ceil(floor / step) * step; value <= ceiling + step * 1e-9; value += step) {
    ticks.push(Number(value.toPrecision(12)));
  }
  return ticks;
}

type TradingPeriod = { start: number; end: number };
interface ChartResult {
  meta?: {
    symbol?: string;
    exchangeTimezoneName?: string;
    dataGranularity?: string;
    tradingPeriods?: TradingPeriod[][] | { regular?: TradingPeriod[][] };
  };
  timestamp?: number[];
  indicators?: { quote?: { open?: unknown[]; high?: unknown[]; low?: unknown[]; close?: unknown[] }[] };
}

const isPrice = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/** Validate the vendor response before any bar can be called this week's. */
export function parseWeeklyChart(body: unknown, symbol: string, now = new Date()): WeeklyChartData {
  const envelope = body as { chart?: { error?: unknown; result?: ChartResult[] } } | null;
  const result = envelope?.chart?.result?.[0];
  if (envelope?.chart?.error || !result || result.meta?.symbol !== symbol ||
      result.meta?.exchangeTimezoneName !== "America/New_York" || result.meta?.dataGranularity !== "30m") {
    throw new Error("Invalid weekly chart response.");
  }
  const week = chartWeek(now);
  const candles = new Map<number, WeeklyCandle>();
  const quote = result.indicators?.quote?.[0];
  // Yahoo omits timestamps before the first print. An empty valid result is
  // different from a malformed chart or an upstream error.
  const stamps = result.timestamp ?? [];
  if (!Array.isArray(stamps) || (stamps.length &&
      (!quote || ![quote.open, quote.high, quote.low, quote.close].every(Array.isArray)))) {
    throw new Error("Missing weekly OHLC data.");
  }
  const supplied = result.meta.tradingPeriods;
  const periods = (Array.isArray(supplied) ? supplied : supplied?.regular)?.flat() ?? [];
  const nowSeconds = now.getTime() / 1000;
  for (const [index, timestamp] of stamps.entries()) {
    if (!Number.isFinite(timestamp) || timestamp > nowSeconds) continue;
    const instant = new Date(timestamp * 1000);
    const date = easternDate(instant);
    const day = week.dates.indexOf(date);
    if (day < 0) continue;
    const { hour, minute } = partsIn("America/New_York", instant);
    const minutes = hour * 60 + minute - 570;
    // Exclude extended hours AND Yahoo's extra 16:00 closing-price marker.
    if (minutes < 0 || minutes >= 390 || minutes % 30 !== 0 || timestamp % 60 !== 0) continue;
    const session = periods.find((period) => timestamp >= period.start && timestamp < period.end);
    if (!session) continue; // Also excludes the closing marker on half days.
    const open = quote!.open![index], high = quote!.high![index];
    const low = quote!.low![index], close = quote!.close![index];
    if (!isPrice(open) || !isPrice(high) || !isPrice(low) || !isPrice(close) ||
        low > Math.min(open, close) || high < Math.max(open, close) || low > high) continue;
    const slot = day * BARS_PER_SESSION + minutes / 30;
    candles.set(slot, {
      timestamp, date, time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      slot, open, high, low, close, complete: nowSeconds >= Math.min(timestamp + 1800, session.end),
    });
  }
  // A response with prints but no valid session metadata is a feed failure,
  // not a holiday or a legitimate empty week.
  if (stamps.length && !periods.length) throw new Error("Missing regular trading sessions.");
  return { symbol, ...week, candles: [...candles.values()].sort((a, b) => a.slot - b.slot), fetchedAt: now.toISOString() };
}
