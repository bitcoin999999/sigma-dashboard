export type SigmaStatus =
  | "NORMAL"
  | "UPPER_1SIGMA"
  | "LOWER_1SIGMA"
  | "OVERHEATED"
  | "OVERSOLD";

/** One strike's net gamma exposure. `netGex` is signed: + cushions, − amplifies. */
export interface GexLevel {
  strike: number;
  netGex: number;
}

/**
 * Dealer gamma exposure for one symbol, as published by the snapshot job.
 *
 * Every figure here is computed upstream by `compactor.summarize_gex` in the
 * uw-analyzer repo — the same single-source rule the σ band follows. Nothing in
 * this app re-derives a level from raw greeks.
 *
 * The sign convention is the whole point: positive net GEX means dealers are
 * long gamma and hedge *against* the move, which is what makes a strike behave
 * like support or resistance. Negative net GEX means they hedge *with* it, so
 * those strikes are acceleration risk, not a floor.
 */
export interface GexProfile {
  /** Settlement date of the open interest behind these figures. */
  asOf: string;
  dealer: "LONG_GAMMA" | "SHORT_GAMMA";
  /** Net gamma across all strikes for `asOf`. */
  netGamma: number;
  /** Recent sessions, oldest first — shows whether the cushion is building. */
  netGammaHistory: { date: string; value: number }[];
  /** Strike where net GEX flips sign, or null when it never does in range. */
  zeroGamma: number | null;
  maxPositive: GexLevel | null;
  maxNegative: GexLevel | null;
  /** Positive-GEX strikes above spot, strongest first. */
  resistance: GexLevel[];
  /** Positive-GEX strikes below spot, strongest first. */
  support: GexLevel[];
  acceleration: (GexLevel & { side: "ABOVE" | "BELOW" })[];
  /** Strikes nearest spot, ascending. The chart series. */
  profile: GexLevel[];
}

/**
 * What a data source (hosted snapshot today, a database later) is expected to
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
  /** Absent when the options feed had nothing usable for this symbol. */
  gex?: GexProfile;
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
