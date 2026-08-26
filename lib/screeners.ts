import { selectGexFloors } from "@/lib/gex-floor";
import { SIGMA_1 } from "@/lib/sigma";
import type { StockData } from "@/lib/types";

export interface Screener {
  slug: string;
  /** Heading on the page itself. */
  title: string;
  /** `<title>` text, written to read as a standalone search result. */
  metaTitle: string;
  metaDescription: string;
  /** One line under the heading saying what the list actually selects for. */
  blurb: string;
  /** Empty-state copy. A screener with no hits is a real, informative result. */
  empty: string;
  select(stocks: StockData[]): StockData[];
}

/**
 * How many names the implied-move list shows.
 *
 * Unlike the two σ screeners it has no natural cut-off — every symbol has an
 * implied move — so the list would otherwise just be the whole board re-sorted.
 */
const IMPLIED_MOVE_LIMIT = 25;

export const SCREENERS: Screener[] = [
  {
    slug: "above-1-sigma",
    title: "Trading above +1σ",
    metaTitle: "Stocks Trading Above +1 Sigma This Week",
    metaDescription:
      "Every tracked symbol currently above the upper 1σ edge of its own weekly implied-move range, ranked by how far past the band it has traded.",
    blurb:
      "Names whose price has left the upper edge of the range their own options were priced for this week. Ranked by distance past the band.",
    empty: "Nothing is trading above its upper 1σ edge right now.",
    select: (stocks) =>
      stocks
        .filter((stock) => stock.zScore >= SIGMA_1)
        .sort((a, b) => b.zScore - a.zScore),
  },
  {
    slug: "below-1-sigma",
    title: "Trading below −1σ",
    metaTitle: "Stocks Trading Below −1 Sigma This Week",
    metaDescription:
      "Every tracked symbol currently below the lower 1σ edge of its own weekly implied-move range, ranked by how far past the band it has traded.",
    blurb:
      "Names whose price has left the lower edge of the range their own options were priced for this week. Ranked by distance past the band.",
    empty: "Nothing is trading below its lower 1σ edge right now.",
    select: (stocks) =>
      stocks
        .filter((stock) => stock.zScore <= -SIGMA_1)
        .sort((a, b) => a.zScore - b.zScore),
  },
  {
    slug: "gex-floor-at-1-sigma",
    title: "GEX floor at −1σ",
    metaTitle: "Stocks With a Dealer Gamma Floor on Their −1 Sigma Edge",
    metaDescription:
      "Symbols whose strongest positive-GEX support strike sits within half a percent of the lower 1σ edge of their weekly expected-move range — two independent levels landing on the same price.",
    blurb:
      "The strongest positive-GEX strike below spot, within ½% of the −1σ edge, and clearly dominant rather than one strike among many. Implied volatility and dealer positioning are different inputs, so agreeing on a price is corroboration. Ranked by how much of the nearby gamma sits on that one strike.",
    empty:
      "No symbol has a dominant gamma floor on its −1σ edge in this snapshot.",
    select: selectGexFloors,
  },
  {
    slug: "highest-implied-move",
    title: "Widest expected move",
    metaTitle: "Stocks With the Widest Expected Move This Week",
    metaDescription:
      "The tracked symbols carrying the widest 1σ implied move for the week — where the options market is pricing the most room in either direction.",
    blurb: `The ${IMPLIED_MOVE_LIMIT} symbols whose options price the widest 1σ move for the week. A wide band is a statement about expected range, not direction.`,
    empty: "No implied-move data in this snapshot.",
    select: (stocks) =>
      [...stocks]
        .sort((a, b) => b.sigmaPercent - a.sigmaPercent)
        .slice(0, IMPLIED_MOVE_LIMIT),
  },
];

export function findScreener(slug: string): Screener | null {
  return SCREENERS.find((screener) => screener.slug === slug) ?? null;
}
