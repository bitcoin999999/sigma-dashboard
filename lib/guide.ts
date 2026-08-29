import { calculateZScore } from "@/lib/sigma";

/**
 * The worked example on the guide page: SNDK, band window Aug 24–28 2026.
 *
 * Frozen on purpose, and the one place in the app that carries prices not read
 * from the snapshot. A teaching example has to keep saying the same thing next
 * month, and a case study wired to the live feed stops being a case study the
 * moment the band rolls over.
 *
 * Every figure is settled history: the closes and the OHLC come from the same
 * Unusual Whales daily series the publisher reads, and the gamma figures are
 * that Tuesday's settled open interest.
 */
export interface CaseSession {
  date: string;
  /** Weekday label for the chart axis. */
  day: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** What happened, in one clause. Empty on the sessions that just drifted. */
  note?: string;
}

const ANCHOR = 1596.08;
const SIGMA_PERCENT = 10.26;

/** Absolute 1σ, derived exactly the way the board derives it. */
const STANDARD_DEVIATION = (ANCHOR * SIGMA_PERCENT) / 100;

const GEX_STRIKE = 1430;

export const CASE = {
  symbol: "SNDK",
  name: "Sandisk",

  /** The Friday close the week's band was struck from. */
  anchorDate: "2026-08-21",
  anchor: ANCHOR,
  sigmaPercent: SIGMA_PERCENT,
  standardDeviation: STANDARD_DEVIATION,
  sigma1Lower: ANCHOR - STANDARD_DEVIATION,
  sigma1Upper: ANCHOR + STANDARD_DEVIATION,

  bandWindow: "Aug 24 – Aug 28, 2026",

  /** The strike carrying the gamma floor, and how it scored on the screen. */
  gex: {
    strike: GEX_STRIKE,
    /** Settlement date of the open interest the board read. */
    asOf: "2026-08-25",
    /** Share of the positive gamma near spot sitting on this one strike, %. */
    share: 36,
    /** How many times the next-strongest support strike this one was. */
    dominance: 82,
    /** Net gamma on the strike at Monday's settlement, before price reached it. */
    netGexMonday: 177,
  },

  sessions: [
    {
      date: "2026-08-24",
      day: "Mon",
      open: 1494.09,
      high: 1516.99,
      low: 1416.56,
      close: 1493.12,
      note: "Opened 6% under the anchor, flushed through both levels inside the first hour, closed back above them.",
    },
    {
      date: "2026-08-25",
      day: "Tue",
      open: 1533.69,
      high: 1564.99,
      low: 1467.01,
      close: 1480.77,
      note: "Traded as high as $1,564.99 — 10.5% off Monday's low.",
    },
    {
      date: "2026-08-26",
      day: "Wed",
      open: 1455.57,
      high: 1511.77,
      low: 1450.05,
      close: 1499.37,
    },
    {
      date: "2026-08-27",
      day: "Thu",
      open: 1549.42,
      high: 1557.89,
      low: 1456.0,
      close: 1484.95,
    },
    {
      date: "2026-08-28",
      day: "Fri",
      open: 1448.0,
      high: 1517.75,
      low: 1435.61,
      close: 1484.98,
      note: "Came back to the same shelf — low $1,435.61, five dollars above the strike — and closed the week inside the band.",
    },
  ] satisfies CaseSession[],
} as const;

/** A price from the case study, in σ off that week's anchor. */
export function caseZ(price: number): number {
  return calculateZScore(price, CASE.anchor, CASE.standardDeviation);
}

/** How far the gamma strike sat from the −1σ edge, as a percentage of it. */
export const CASE_GAP_PERCENT =
  ((CASE.gex.strike - CASE.sigma1Lower) / CASE.sigma1Lower) * 100;
