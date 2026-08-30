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
  /** Absent when the intraday feed was short or landed on a different session. */
  intraday?: IntradaySeries;
  /** The band that closed most recently. Absent when it could not be sourced. */
  lastWeek?: WeeklyBand;
  /**
   * The band that closed the Friday before `lastWeek` did.
   *
   * Two settled weeks side by side is what turns a single reading into a
   * direction: −1.1σ after a flat week is a different story from −1.1σ after
   * another −1σ week.
   *
   * Independently optional. The publisher fills these two slots positionally
   * and omits whichever it cannot source, so a present `weekBeforeLast` next to
   * an absent `lastWeek` is possible and means exactly what it says — it is
   * never the older band shuffled up into the newer slot.
   */
  weekBeforeLast?: WeeklyBand;
}

/**
 * A band that has already closed — last week's anchor and what price did inside
 * it.
 *
 * Raw inputs only, exactly like `Quote`. z is derived in `lib/sigma.ts` through
 * the same `(price − anchor) / (anchor × sigmaPercent/100)` path the live band
 * uses, so a finished week and the running one are read off the same ruler.
 *
 * Absent when the publisher had no anchor σ cached for that week. It is never
 * reconstructed from current implied volatility: pricing a finished week with
 * this week's IV is the 1.47× divergence the upstream single-source rule exists
 * to prevent, and it would silently rescale every number in the table.
 */
export interface WeeklyBand {
  /** The Friday close the band was struck from. */
  anchorDate: string;
  anchor: number;
  sigmaPercent: number;
  /**
   * Sessions inside the band, oldest first — the anchor itself is excluded, and
   * the last entry is the closing Friday.
   */
  closes: { date: string; close: number }[];
}

/**
 * One regular session, bar by bar.
 *
 * The publisher only emits this when the bars belong to the same session
 * `price` came from. That check is not cosmetic: a chart from another day
 * sitting under the "… close" label is stale data wearing a current label.
 */
export interface IntradaySeries {
  date: string;
  /** Bar size the publisher used, e.g. "5m". Displayed, never parsed. */
  candle: string;
  /** Oldest first. `time` is ET "HH:MM", running 09:30 → 16:00. */
  points: { time: string; close: number }[];
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
  /**
   * ISO instant at which the upstream publisher produced this snapshot.
   *
   * Carried raw rather than pre-formatted because it is the one figure that
   * answers "how old is this board?", and the answer only means something in
   * market time — the reader has to see it in ET, not in their own zone.
   */
  generatedAt: string;
  /**
   * Calendar date of the regular session every price came from, e.g.
   * "2026-08-21". `updatedAt` is the same fact spelled for a human.
   */
  sessionDate: string;
  /** Anchor date of the σ band, i.e. the close the band was struck from. */
  bandAnchor: string;
  /** Same anchor as an ISO calendar date, for surfaces that spell it themselves. */
  bandAnchorDate: string;
  bandWindow: string;
  /**
   * Regular sessions elapsed since the anchor close.
   *
   * `0` means the band was struck at the most recent close and has not been
   * traded yet — the Saturday state, where every z is 0 by construction and the
   * board is showing the range for the week ahead rather than a result.
   */
  bandElapsed: number;
}

/** How the watchlist is laid out. Presentation only — never filters anything. */
export type ViewMode = "CARD" | "LIST";

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
