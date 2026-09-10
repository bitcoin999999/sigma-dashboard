import { selectGexFloors } from "@/lib/gex-floor";
import { SIGMA_1 } from "@/lib/sigma";
import type { StockData } from "@/lib/types";
import type { Locale } from "@/lib/i18n";

interface ScreenerCopy {
  title: string;
  metaTitle: string;
  metaDescription: string;
  blurb: string;
  empty: string;
}

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
  copy: Record<Locale, ScreenerCopy>;
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
    copy: {
      en: { title: "Trading above +1σ", metaTitle: "Stocks Trading Above +1 Sigma This Week", metaDescription: "Every tracked symbol currently above the upper 1σ edge of its own weekly implied-move range, ranked by how far past the band it has traded.", blurb: "Names whose price has left the upper edge of the range their own options were priced for this week. Ranked by distance past the band.", empty: "Nothing is trading above its upper 1σ edge right now." },
      ko: { title: "+1σ 상단 돌파", metaTitle: "이번 주 +1σ 상단을 돌파한 종목", metaDescription: "각 종목의 주간 implied-move 범위 상단 +1σ를 넘은 종목을 밴드 이탈 거리순으로 보여줍니다.", blurb: "이번 주 옵션 시장이 반영한 상단 범위를 벗어난 종목입니다. 밴드 이탈 거리순으로 정렬합니다.", empty: "현재 +1σ 상단을 돌파한 종목이 없습니다." },
    },
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
    copy: {
      en: { title: "Trading below −1σ", metaTitle: "Stocks Trading Below −1 Sigma This Week", metaDescription: "Every tracked symbol currently below the lower 1σ edge of its own weekly implied-move range, ranked by how far past the band it has traded.", blurb: "Names whose price has left the lower edge of the range their own options were priced for this week. Ranked by distance past the band.", empty: "Nothing is trading below its lower 1σ edge right now." },
      ko: { title: "−1σ 하단 이탈", metaTitle: "이번 주 −1σ 하단을 이탈한 종목", metaDescription: "각 종목의 주간 implied-move 범위 하단 −1σ를 내려간 종목을 밴드 이탈 거리순으로 보여줍니다.", blurb: "이번 주 옵션 시장이 반영한 하단 범위를 벗어난 종목입니다. 밴드 이탈 거리순으로 정렬합니다.", empty: "현재 −1σ 하단을 이탈한 종목이 없습니다." },
    },
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
    copy: {
      en: { title: "GEX floor at −1σ", metaTitle: "Stocks With a Dealer Gamma Floor on Their −1 Sigma Edge", metaDescription: "Symbols whose strongest positive-GEX support strike sits within half a percent of the lower 1σ edge of their weekly expected-move range — two independent levels landing on the same price.", blurb: "The strongest positive-GEX strike below spot, within ½% of the −1σ edge, and clearly dominant rather than one strike among many. Implied volatility and dealer positioning are different inputs, so agreeing on a price is corroboration. Ranked by how much of the nearby gamma sits on that one strike.", empty: "No symbol has a dominant gamma floor on its −1σ edge in this snapshot." },
      ko: { title: "−1σ GEX floor", metaTitle: "−1σ 근처에 딜러 gamma floor가 있는 종목", metaDescription: "주간 expected-move 범위의 −1σ 하단과 0.5% 이내에 가장 강한 positive-GEX 지지 행사가가 있는 종목입니다.", blurb: "현재가 아래의 가장 강한 positive-GEX 행사가가 −1σ 하단 0.5% 이내에 있고, 주변 gamma 중 명확하게 지배적인 종목입니다. Implied volatility와 딜러 포지셔닝은 독립적인 입력이므로 같은 가격을 가리키면 확인 근거가 됩니다.", empty: "이 스냅샷에서 −1σ 하단에 지배적인 gamma floor가 있는 종목이 없습니다." },
    },
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
    copy: {
      en: { title: "Widest expected move", metaTitle: "Stocks With the Widest Expected Move This Week", metaDescription: "The tracked symbols carrying the widest 1σ implied move for the week — where the options market is pricing the most room in either direction.", blurb: `The ${IMPLIED_MOVE_LIMIT} symbols whose options price the widest 1σ move for the week. A wide band is a statement about expected range, not direction.`, empty: "No implied-move data in this snapshot." },
      ko: { title: "Expected move 상위", metaTitle: "이번 주 expected move가 가장 넓은 종목", metaDescription: "주간 1σ implied move가 가장 넓은 종목으로, 옵션 시장이 양방향 변동 여지를 가장 크게 반영한 종목입니다.", blurb: `옵션 시장이 이번 주 1σ 변동폭을 가장 넓게 반영한 ${IMPLIED_MOVE_LIMIT}개 종목입니다. 넓은 밴드는 방향이 아니라 예상 범위를 의미합니다.`, empty: "이 스냅샷에 implied-move 데이터가 없습니다." },
    },
    select: (stocks) =>
      [...stocks]
        .sort((a, b) => b.sigmaPercent - a.sigmaPercent)
        .slice(0, IMPLIED_MOVE_LIMIT),
  },
];

export function findScreener(slug: string): Screener | null {
  return SCREENERS.find((screener) => screener.slug === slug) ?? null;
}
