import type { GexProfile, StockData } from "@/lib/types";

/**
 * Two independent reasons for price to stop, landing on the same number.
 *
 * The −1σ edge is where the options market priced the week's expected move to
 * end. A positive-GEX strike is where dealers are long gamma and therefore hedge
 * *against* the move — they buy into weakness at that strike. Those two are
 * derived from different things (implied volatility for the week versus open
 * interest sitting at one strike), so when they agree on a price the level is
 * corroborated rather than merely restated.
 *
 * This is a screen, not a prediction. Nothing here says the floor holds.
 */
export interface GexFloor {
  /** The strike carrying the floor. */
  strike: number;
  /** Net gamma exposure at that strike. Positive by construction. */
  netGex: number;
  /**
   * Where the strike sits relative to the −1σ edge, as a percentage of it.
   * Negative means the floor is below the band edge.
   */
  gapPercent: number;
  /** The floor's share of all positive gamma in the published window, 0–100. */
  share: number;
  /**
   * How many times the next-strongest support strike this one is. `Infinity`
   * when it is the only support strike in the window.
   */
  dominance: number;
}

/**
 * How far the floor may sit from the −1σ edge and still count as the same
 * level. Half a percent is narrow enough that the two are indistinguishable on
 * the band bar and, at typical strike spacing, is usually a single strike wide.
 */
const MAX_GAP_PERCENT = 0.5;

/**
 * The bar for "this strike is the floor" rather than "this strike has some
 * gamma on it". Both thresholds have to clear, because each misses on its own:
 * a strike can hold a large share of a thin window, or beat a second strike
 * that is itself negligible.
 *
 * Calibrated against the published board rather than picked round: the median
 * primary support strike carries ~12% of the positive gamma near spot and is
 * ~2.8× the next one, so these sit around the upper quartile. On the Aug 25
 * board that admitted SNDK (36% share, 82×) and rejected AAPL (0.6% share) —
 * both of which had a support strike inside the window.
 */
export const MIN_SHARE = 15;
export const MIN_DOMINANCE = 2;

/**
 * The floor for one symbol, or null when there is not one worth drawing.
 *
 * Only the *primary* support strike is considered. A secondary strike that
 * happens to line up with the band edge is not the level the market is leaning
 * on, and admitting it would fill the screen with coincidences.
 */
export function findGexFloor(stock: StockData): GexFloor | null {
  const gex: GexProfile | undefined = stock.gex;
  if (!gex) return null;

  const floor = gex.support[0];
  if (!floor || floor.netGex <= 0) return null;

  // A band with no width cannot be compared against anything, and dividing by
  // the edge below would not be meaningful either.
  if (!stock.sigma1Lower || stock.standardDeviation <= 0) return null;

  const gapPercent =
    ((floor.strike - stock.sigma1Lower) / stock.sigma1Lower) * 100;
  if (Math.abs(gapPercent) > MAX_GAP_PERCENT) return null;

  const positive = gex.profile
    .map((level) => level.netGex)
    .filter((value) => value > 0);
  const total = positive.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return null;

  const share = (floor.netGex / total) * 100;
  const next = gex.support[1]?.netGex ?? 0;
  const dominance = next > 0 ? floor.netGex / next : Infinity;

  if (share < MIN_SHARE || dominance < MIN_DOMINANCE) return null;

  return {
    strike: floor.strike,
    netGex: floor.netGex,
    gapPercent,
    share,
    dominance,
  };
}

/**
 * How many positive strikes the window needs before `share` means anything.
 *
 * On a window holding one positive strike the primary support owns 100% of it
 * by arithmetic — that is a fact about how thin the chain is, not about the
 * level. `findGexFloor` can ignore this because the −1σ agreement is a second,
 * independent filter; a ranking built on share alone cannot. On the Sep 18
 * board this rejected KEEL (one positive strike, 100% share) and XPEV (three,
 * 27%) while keeping NVDA, GLD and QQQ.
 */
export const MIN_POSITIVE_STRIKES = 5;

export interface GexSupport {
  strike: number;
  netGex: number;
  /** The strike's share of all positive gamma in the published window, 0–100. */
  share: number;
  /** How many times the next-strongest support strike this one is. */
  dominance: number;
  /** How far under spot the strike sits, as a percentage of spot. */
  distancePercent: number;
  /** The strike is also on the −1σ edge — i.e. `findGexFloor` took it too. */
  confluence: boolean;
}

/**
 * The largest options support under spot, with or without a σ edge behind it.
 *
 * `findGexFloor` answers "do two independent methods agree on one price". This
 * answers the broader question a trader asks first — "where is the option
 * market's weight sitting under this name today" — and it is deliberately
 * blind to the band.
 *
 * Dropping the −1σ test removes the corroboration that made the floor worth
 * trusting, so two guards replace it: the strike has to be inside the week's
 * reach, because gamma parked below −1.5σ is not today's business, and the
 * window has to clear `MIN_POSITIVE_STRIKES`.
 *
 * This is a screen, not a prediction. Nothing here says the level holds.
 */
export function findGexSupport(stock: StockData): GexSupport | null {
  const gex: GexProfile | undefined = stock.gex;
  if (!gex) return null;

  const primary = gex.support[0];
  if (!primary || primary.netGex <= 0) return null;

  // Out of reach for the week the card is dated to.
  if (stock.standardDeviation > 0 && primary.strike < stock.sigmaExtremeLower) {
    return null;
  }

  const positive = gex.profile
    .map((level) => level.netGex)
    .filter((value) => value > 0);
  if (positive.length < MIN_POSITIVE_STRIKES) return null;

  const total = positive.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return null;

  const share = (primary.netGex / total) * 100;
  const next = gex.support[1]?.netGex ?? 0;
  const dominance = next > 0 ? primary.netGex / next : Infinity;

  if (share < MIN_SHARE || dominance < MIN_DOMINANCE) return null;

  return {
    strike: primary.strike,
    netGex: primary.netGex,
    share,
    dominance,
    distancePercent: stock.price
      ? ((primary.strike - stock.price) / stock.price) * 100
      : 0,
    confluence: Boolean(findGexFloor(stock)),
  };
}

/** The board's floors, strongest first. */
export function selectGexFloors(stocks: StockData[]): StockData[] {
  return stocks
    .map((stock) => ({ stock, floor: findGexFloor(stock) }))
    .filter((entry): entry is { stock: StockData; floor: GexFloor } =>
      Boolean(entry.floor),
    )
    .sort((a, b) => b.floor.share - a.floor.share)
    .map((entry) => entry.stock);
}
