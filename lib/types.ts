export type SigmaStatus =
  | "NORMAL"
  | "UPPER_1SIGMA"
  | "LOWER_1SIGMA"
  | "OVERHEATED"
  | "OVERSOLD";

/**
 * What a data source (mock file today, market API later) is expected to
 * provide. Everything else on `StockData` is derived from these fields.
 *
 * `anchor` is the close the σ band was struck from — the band is centred on a
 * fixed reference price, not on a rolling average. `sigmaPercent` is the 1σ
 * move as a percentage of `anchor`, which is how implied-move feeds quote it.
 * Absolute σ is derived, not stored.
 */
export interface Quote {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  previousClose: number;
  anchor: number;
  sigmaPercent: number;
  /** Recent regular-session closes, oldest first. Charted, never derived from. */
  history: { date: string; close: number }[];
}

export interface SectorEtfQuote extends Quote {
  /** Human-readable sector the ETF tracks, e.g. "Technology". */
  sectorLabel: string;
}

export interface StockData extends Quote {
  changePercent: number;
  changeAbsolute: number;

  /** Absolute 1σ in price units. */
  standardDeviation: number;

  sigma1Upper: number;
  sigma1Lower: number;
  sigmaExtremeUpper: number;
  sigmaExtremeLower: number;

  zScore: number;
  status: SigmaStatus;
}

export interface SectorEtfData extends StockData {
  /** Human-readable sector the ETF tracks, e.g. "Technology". */
  sectorLabel: string;
}

export interface MarketSnapshot {
  session: "PRE" | "OPEN" | "AFTER" | "CLOSED";
  updatedAt: string;
  /** Anchor date of the σ band, i.e. the close the band was struck from. */
  bandAnchor: string;
  bandWindow: string;
  /** True once the reference session is the closing Friday — the week is done. */
  settled: boolean;
}

export type SortKey =
  | "SYMBOL"
  | "CHANGE"
  | "ZSCORE"
  | "MOST_OVERHEATED"
  | "MOST_OVERSOLD";

export type FilterKey =
  | "ALL"
  | "NORMAL"
  | "UPPER_1SIGMA"
  | "OVERHEATED"
  | "LOWER_1SIGMA"
  | "OVERSOLD";
