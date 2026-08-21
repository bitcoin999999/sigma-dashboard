import type {
  FilterKey,
  Quote,
  SigmaStatus,
  SortKey,
  StockData,
  WeeklyBand,
} from "@/lib/types";

/**
 * Band edges, in standard deviations. ±1.5 is the extreme threshold because
 * that is where the upstream weekly-sigma alerting scores a symbol as
 * dislocated — the dashboard and the alert must call the same name overheated.
 */
export const SIGMA_1 = 1.0;
export const SIGMA_EXTREME = 1.5;

/** How far past ±1.5σ the visualisation still tracks before clamping. */
export const BAND_LIMIT = 2.0;

export function calculateZScore(
  price: number,
  anchor: number,
  standardDeviation: number,
): number {
  if (!standardDeviation) return 0;
  return (price - anchor) / standardDeviation;
}

export function resolveStatus(zScore: number): SigmaStatus {
  if (zScore >= SIGMA_EXTREME) return "OVERHEATED";
  if (zScore >= SIGMA_1) return "UPPER_1SIGMA";
  if (zScore <= -SIGMA_EXTREME) return "OVERSOLD";
  if (zScore <= -SIGMA_1) return "LOWER_1SIGMA";
  return "NORMAL";
}

/**
 * Turns a raw quote into the full derived record the UI renders.
 * The upstream publisher only has to satisfy `Quote` for the UI to render.
 */
export function buildStockData(quote: Quote): StockData {
  const standardDeviation = (quote.anchor * quote.sigmaPercent) / 100;
  const zScore = calculateZScore(quote.price, quote.anchor, standardDeviation);
  const changeAbsolute = quote.price - quote.previousClose;

  return {
    ...quote,
    standardDeviation,
    changeAbsolute,
    changePercent: quote.previousClose
      ? (changeAbsolute / quote.previousClose) * 100
      : 0,
    sigma1Upper: quote.anchor + standardDeviation,
    sigma1Lower: quote.anchor - standardDeviation,
    sigmaExtremeUpper: quote.anchor + SIGMA_EXTREME * standardDeviation,
    sigmaExtremeLower: quote.anchor - SIGMA_EXTREME * standardDeviation,
    zScore,
    status: resolveStatus(zScore),
  };
}

export function buildStockList(quotes: Quote[]): StockData[] {
  return quotes.map(buildStockData);
}

/** A finished week scored against its own anchor. */
export interface WeeklyBandResult {
  anchorDate: string;
  anchor: number;
  /** Absolute 1σ in price units, fixed for that week. */
  standardDeviation: number;

  /**
   * Where the week actually ended, at the closing Friday. This is the settled
   * result — the number the band is judged on.
   */
  closeZ: number;
  closeDate: string;
  close: number;
  status: SigmaStatus;

  /**
   * The furthest any close inside the week got from the anchor, signed and
   * kept with its date.
   *
   * Measured on closes only, because closes are all the snapshot carries — an
   * intraday spike that came back by the bell is invisible here. That is the
   * honest reading of the data rather than a floor-to-ceiling range it cannot
   * support.
   */
  peakZ: number;
  peakDate: string;
  /** True when the week ended somewhere other than its own extreme. */
  retraced: boolean;
}

/**
 * Scores a closed band. Returns null when the inputs cannot produce a z at all,
 * which is the same "no data" the publisher signals by omitting the block.
 */
export function buildWeeklyBand(band: WeeklyBand): WeeklyBandResult | null {
  const standardDeviation = (band.anchor * band.sigmaPercent) / 100;
  if (!standardDeviation || band.closes.length === 0) return null;

  const zAt = (close: number) =>
    calculateZScore(close, band.anchor, standardDeviation);

  const last = band.closes[band.closes.length - 1];
  const closeZ = zAt(last.close);

  let peakZ = 0;
  let peakDate = last.date;
  for (const point of band.closes) {
    const z = zAt(point.close);
    if (Math.abs(z) > Math.abs(peakZ)) {
      peakZ = z;
      peakDate = point.date;
    }
  }

  return {
    anchorDate: band.anchorDate,
    anchor: band.anchor,
    standardDeviation,
    closeZ,
    closeDate: last.date,
    close: last.close,
    status: resolveStatus(closeZ),
    peakZ,
    peakDate,
    // A tenth of a sigma of slack: rounding to two decimals means a peak and a
    // close that print the same string can still differ in the raw float, and
    // flagging that as a retracement would be noise.
    retraced: Math.abs(peakZ) - Math.abs(closeZ) >= 0.1,
  };
}

/** Position of a z-score along the band track, as 0–100%. */
export function bandPosition(zScore: number, limit = BAND_LIMIT): number {
  const clamped = Math.min(Math.max(zScore, -limit), limit);
  return ((clamped + limit) / (limit * 2)) * 100;
}

export function isBeyondBand(zScore: number, limit = BAND_LIMIT): boolean {
  return Math.abs(zScore) > limit;
}

export interface StatusMeta {
  /** Compact label used on badges. */
  label: string;
  /** Spelled-out label for legends and tooltips. */
  longLabel: string;
  description: string;
  /** CSS custom property holding this status' accent colour. */
  colorVar: string;
  /** Sort weight — extremes first, normal last. */
  severity: number;
}

export const STATUS_META: Record<SigmaStatus, StatusMeta> = {
  OVERHEATED: {
    label: "OVERHEATED",
    longLabel: "Above +1.5σ",
    description:
      "More than 1.5 standard deviations above the anchor close. Statistically stretched to the upside.",
    colorVar: "--sigma-hot",
    severity: 4,
  },
  UPPER_1SIGMA: {
    label: "+1σ",
    longLabel: "Above +1σ",
    description:
      "Broke the upper 1σ edge of its expected range but has not reached the overheated threshold.",
    colorVar: "--sigma-upper",
    severity: 3,
  },
  NORMAL: {
    label: "NORMAL",
    longLabel: "Within ±1σ",
    description: "Inside the expected range. No statistical dislocation.",
    colorVar: "--sigma-normal",
    severity: 0,
  },
  LOWER_1SIGMA: {
    label: "−1σ",
    longLabel: "Below −1σ",
    description:
      "Broke the lower 1σ edge of its expected range but has not reached the oversold threshold.",
    colorVar: "--sigma-lower",
    severity: 3,
  },
  OVERSOLD: {
    label: "OVERSOLD",
    longLabel: "Below −1.5σ",
    description:
      "More than 1.5 standard deviations below the anchor close. Statistically stretched to the downside.",
    colorVar: "--sigma-cold",
    severity: 4,
  },
};

export const STATUS_ORDER: SigmaStatus[] = [
  "OVERHEATED",
  "UPPER_1SIGMA",
  "NORMAL",
  "LOWER_1SIGMA",
  "OVERSOLD",
];

/** Inline style that hands `--state` to any element using the state-* classes. */
export function statusStyle(status: SigmaStatus): React.CSSProperties {
  return {
    ["--state" as string]: `var(${STATUS_META[status].colorVar})`,
  } as React.CSSProperties;
}

export interface StatusCounts {
  total: number;
  beyondUpper1: number;
  overheated: number;
  beyondLower1: number;
  oversold: number;
  normal: number;
  approaching: number;
  averageZ: number;
}

export function summarize(stocks: StockData[]): StatusCounts {
  const counts: StatusCounts = {
    total: stocks.length,
    beyondUpper1: 0,
    overheated: 0,
    beyondLower1: 0,
    oversold: 0,
    normal: 0,
    approaching: 0,
    averageZ: 0,
  };

  let zSum = 0;
  for (const stock of stocks) {
    zSum += stock.zScore;
    if (stock.zScore >= SIGMA_1) counts.beyondUpper1 += 1;
    if (stock.zScore >= SIGMA_EXTREME) counts.overheated += 1;
    if (stock.zScore <= -SIGMA_1) counts.beyondLower1 += 1;
    if (stock.zScore <= -SIGMA_EXTREME) counts.oversold += 1;
    if (stock.status === "NORMAL") counts.normal += 1;
    if (stock.status === "NORMAL" && Math.abs(stock.zScore) >= 0.85) {
      counts.approaching += 1;
    }
  }

  counts.averageZ = stocks.length ? zSum / stocks.length : 0;
  return counts;
}

const FILTER_PREDICATES: Record<FilterKey, (stock: StockData) => boolean> = {
  ALL: () => true,
  NORMAL: (s) => s.status === "NORMAL",
  UPPER_1SIGMA: (s) => s.zScore >= SIGMA_1,
  OVERHEATED: (s) => s.zScore >= SIGMA_EXTREME,
  LOWER_1SIGMA: (s) => s.zScore <= -SIGMA_1,
  OVERSOLD: (s) => s.zScore <= -SIGMA_EXTREME,
};

export function filterStocks(
  stocks: StockData[],
  filter: FilterKey,
  query: string,
): StockData[] {
  const needle = query.trim().toUpperCase();
  const predicate = FILTER_PREDICATES[filter];

  return stocks.filter((stock) => {
    if (!predicate(stock)) return false;
    if (!needle) return true;
    return (
      stock.symbol.includes(needle) ||
      stock.name.toUpperCase().includes(needle) ||
      stock.sector.toUpperCase().includes(needle)
    );
  });
}

/**
 * Default ordering surfaces dislocation first: anything past ±1.5σ floats to
 * the top regardless of the chosen sort, which is the whole point of the page.
 */
function severityRank(stock: StockData): number {
  return STATUS_META[stock.status].severity;
}

export function sortStocks(stocks: StockData[], sort: SortKey): StockData[] {
  const sorted = [...stocks];

  switch (sort) {
    case "SYMBOL":
      sorted.sort((a, b) => a.symbol.localeCompare(b.symbol));
      break;
    case "CHANGE":
      sorted.sort((a, b) => b.changePercent - a.changePercent);
      break;
    case "ZSCORE":
      sorted.sort(
        (a, b) =>
          Math.abs(b.zScore) - Math.abs(a.zScore) ||
          a.symbol.localeCompare(b.symbol),
      );
      break;
    case "MOST_OVERHEATED":
      sorted.sort((a, b) => b.zScore - a.zScore);
      break;
    case "MOST_OVERSOLD":
      sorted.sort((a, b) => a.zScore - b.zScore);
      break;
  }

  if (sort === "SYMBOL" || sort === "CHANGE") {
    sorted.sort((a, b) => severityRank(b) - severityRank(a));
  }

  return sorted;
}

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "ZSCORE", label: "Z-Score" },
  { key: "MOST_OVERHEATED", label: "Most Overheated" },
  { key: "MOST_OVERSOLD", label: "Most Oversold" },
  { key: "CHANGE", label: "Change %" },
  { key: "SYMBOL", label: "Symbol" },
];

export const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "NORMAL", label: "Normal" },
  { key: "UPPER_1SIGMA", label: "+1σ" },
  { key: "OVERHEATED", label: "+1.5σ Overheated" },
  { key: "LOWER_1SIGMA", label: "−1σ" },
  { key: "OVERSOLD", label: "−1.5σ Oversold" },
];
