/**
 * Leveraged and inverse funds, grouped under the plain ETF people chart.
 *
 * A trader reads a level off QQQ and then has to buy TQQQ, so the question is
 * always "QQQ at 700 is TQQQ at what?". Each family names one unleveraged fund
 * and the daily-reset products written on the same index.
 */

export interface LeveragedFund {
  symbol: string;
  name: string;
  /**
   * Multiple of the index's *daily* return the fund targets. Negative for
   * inverse funds. This is a return multiplier, never a price ratio.
   */
  multiple: number;
}

export interface LeverageFamily {
  /** The unleveraged fund, and the chart every projection is read off. */
  base: string;
  baseName: string;
  /** The index the whole family is written on. */
  index: string;
  funds: LeveragedFund[];
}

/**
 * Five of the most heavily traded US equity ETFs and their leverage ladders.
 *
 * Bases are picked so the leveraged funds track the same index rather than a
 * near neighbour: SOXL/SOXS sit against SOXX, not SMH, whose index holds a
 * different basket. Funds are ordered long-to-short so the ladder reads down.
 */
export const LEVERAGE_FAMILIES: LeverageFamily[] = [
  {
    base: "QQQ",
    baseName: "Invesco QQQ Trust",
    index: "Nasdaq 100",
    funds: [
      { symbol: "TQQQ", name: "ProShares UltraPro QQQ", multiple: 3 },
      { symbol: "QLD", name: "ProShares Ultra QQQ", multiple: 2 },
      { symbol: "PSQ", name: "ProShares Short QQQ", multiple: -1 },
      { symbol: "QID", name: "ProShares UltraShort QQQ", multiple: -2 },
      { symbol: "SQQQ", name: "ProShares UltraPro Short QQQ", multiple: -3 },
    ],
  },
  {
    base: "SPY",
    baseName: "SPDR S&P 500 ETF Trust",
    index: "S&P 500",
    funds: [
      { symbol: "UPRO", name: "ProShares UltraPro S&P500", multiple: 3 },
      { symbol: "SSO", name: "ProShares Ultra S&P500", multiple: 2 },
      { symbol: "SH", name: "ProShares Short S&P500", multiple: -1 },
      { symbol: "SDS", name: "ProShares UltraShort S&P500", multiple: -2 },
      { symbol: "SPXU", name: "ProShares UltraPro Short S&P500", multiple: -3 },
    ],
  },
  {
    base: "SOXX",
    baseName: "iShares Semiconductor ETF",
    index: "Semiconductors",
    funds: [
      {
        symbol: "SOXL",
        name: "Direxion Daily Semiconductor Bull 3X",
        multiple: 3,
      },
      {
        symbol: "SOXS",
        name: "Direxion Daily Semiconductor Bear 3X",
        multiple: -3,
      },
    ],
  },
  {
    base: "DRAM",
    baseName: "Roundhill Memory ETF",
    index: "Memory",
    // No inverse product exists on this one, which is why the ladder is a
    // single rung rather than a pair.
    funds: [
      {
        symbol: "RAM",
        name: "Roundhill T-REX 2X Long DRAM",
        multiple: 2,
      },
    ],
  },
  {
    base: "IWM",
    baseName: "iShares Russell 2000 ETF",
    index: "Russell 2000",
    funds: [
      { symbol: "TNA", name: "Direxion Daily Small Cap Bull 3X", multiple: 3 },
      { symbol: "UWM", name: "ProShares Ultra Russell2000", multiple: 2 },
      { symbol: "RWM", name: "ProShares Short Russell2000", multiple: -1 },
      { symbol: "TZA", name: "Direxion Daily Small Cap Bear 3X", multiple: -3 },
    ],
  },
  {
    base: "DIA",
    baseName: "SPDR Dow Jones Industrial Average ETF",
    index: "Dow 30",
    funds: [
      { symbol: "UDOW", name: "ProShares UltraPro Dow30", multiple: 3 },
      { symbol: "DDM", name: "ProShares Ultra Dow30", multiple: 2 },
      { symbol: "DOG", name: "ProShares Short Dow30", multiple: -1 },
      { symbol: "SDOW", name: "ProShares UltraPro Short Dow30", multiple: -3 },
    ],
  },
];

/** Every symbol the page needs a live price for, bases included. */
export const LEVERAGE_SYMBOLS: string[] = LEVERAGE_FAMILIES.flatMap(
  (family) => [family.base, ...family.funds.map((fund) => fund.symbol)],
);

/**
 * Where a leveraged fund lands if its index makes `movePercent` from here.
 *
 * These funds promise `multiple ×` the index's *daily* return, so the move is
 * applied to the fund's own price rather than converted through a price ratio.
 * That makes this exact for one move off the prices both legs were read at, and
 * only approximate across sessions: a multi-day path compounds, and a round
 * trip that leaves the index flat still leaves the fund lower.
 *
 * The result is allowed to go negative; the caller decides how to show a move
 * large enough to wipe the fund out, because silently clamping to zero would
 * hide exactly the case worth seeing.
 */
export function projectFundPrice(
  price: number,
  multiple: number,
  movePercent: number,
): number {
  return price * (1 + (multiple * movePercent) / 100);
}

/** "3×", "−3×" — the ladder rung, with a real minus sign. */
export function formatMultiple(multiple: number): string {
  return `${multiple < 0 ? "−" : ""}${Math.abs(multiple)}×`;
}
