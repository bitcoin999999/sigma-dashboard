import {
  findGexFloor,
  findGexSupport,
  type GexFloor,
  type GexSupport,
} from "@/lib/gex-floor";
import { SIGMA_1 } from "@/lib/sigma";
import type { StockData } from "@/lib/types";
import { pick, type Locale } from "@/lib/i18n";

/** Rows on the share card. Any more and the 1200×630 frame stops being legible. */
export const DAILY_LIMIT = 5;

/** The level that earned a symbol its slot. Absent on the fallback lists. */
export interface DailyLevel {
  strike: number;
  /** The strike's share of all positive gamma in the published window, 0–100. */
  share: number;
  /** The strike also sits on the −1σ edge. */
  confluence: boolean;
}

export interface DailyPick {
  stock: StockData;
  level?: DailyLevel;
}

/** A labelled run of picks. Two at most, and the order is the priority. */
export interface DailySection {
  title: string;
  note: string;
  picks: DailyPick[];
}

export interface DailyDigest {
  /** Headline. The page and the share image must say the same thing. */
  heading: string;
  /** One line saying what the list selected for. */
  subheading: string;
  sections: DailySection[];
  /** Every pick, in the order the sections present them. */
  picks: DailyPick[];
  stocks: StockData[];
}

function digest(
  heading: string,
  subheading: string,
  sections: DailySection[],
): DailyDigest {
  const picks = sections.flatMap((section) => section.picks);
  return {
    heading,
    subheading,
    sections,
    picks,
    stocks: picks.map((entry) => entry.stock),
  };
}

/**
 * The handful of names worth putting on a card for one session.
 *
 * The card answers one question: which tickers should a trader open today. The
 * σ reading alone is a poor answer to it — on the day the band is struck every
 * z is 0 by construction, and "furthest from the middle" is a result, not a
 * reason to look. So the card leads with price levels instead.
 *
 * First the confluences: a positive-GEX strike landing on the −1σ edge, two
 * independently derived numbers agreeing on one price. That is the rarest and
 * strongest thing this board can find, and it is the purple the rest of the UI
 * already marks. Then, wherever the band happens to sit, the names carrying
 * the largest options support under spot.
 *
 * Only when neither exists does it fall back to σ distance, which is the old
 * behaviour and still the right thing to show on a board with no levels on it.
 */
export function buildDailyDigest(
  stocks: StockData[],
  bandElapsed: number,
  locale: Locale = "en",
): DailyDigest {
  const confluences = stocks
    .map((stock) => ({ stock, floor: findGexFloor(stock) }))
    .filter((entry): entry is { stock: StockData; floor: GexFloor } =>
      Boolean(entry.floor),
    )
    .sort((a, b) => b.floor.share - a.floor.share)
    .slice(0, DAILY_LIMIT);

  const taken = new Set(confluences.map((entry) => entry.stock.symbol));

  // Ranked by concentration rather than raw gamma: net GEX in dollars mostly
  // measures how big the ticker is, so sorting on it would print the same four
  // mega-caps every session. Share asks the question the card is about — how
  // much of the weight near spot is sitting on this one strike.
  const supports = stocks
    .filter((stock) => !taken.has(stock.symbol))
    .map((stock) => ({ stock, support: findGexSupport(stock) }))
    .filter((entry): entry is { stock: StockData; support: GexSupport } =>
      Boolean(entry.support),
    )
    .sort(
      (a, b) =>
        b.support.share - a.support.share ||
        b.support.dominance - a.support.dominance,
    )
    .slice(0, Math.max(0, DAILY_LIMIT - confluences.length));

  const sections: DailySection[] = [];

  if (confluences.length > 0) {
    sections.push({
      title: pick(locale, "−1σ 하단과 겹치는 GEX 지지", "GEX support on the −1σ edge"),
      note: pick(
        locale,
        "서로 다른 두 근거가 같은 가격을 가리킵니다",
        "Two independently derived levels landing on one price",
      ),
      picks: confluences.map(({ stock, floor }) => ({
        stock,
        level: { strike: floor.strike, share: floor.share, confluence: true },
      })),
    });
  }

  if (supports.length > 0) {
    sections.push({
      title: pick(locale, "가장 큰 옵션 지지", "Largest options support"),
      note: pick(
        locale,
        "σ 구간과 무관하게, 주가 아래 감마가 가장 두껍게 쌓인 자리",
        "The thickest gamma under spot, wherever the band sits",
      ),
      picks: supports.map(({ stock, support }) => ({
        stock,
        level: {
          strike: support.strike,
          share: support.share,
          confluence: false,
        },
      })),
    });
  }

  if (sections.length > 0) {
    return digest(
      pick(locale, "오늘 열어볼 종목", "Worth opening today"),
      pick(
        locale,
        "옵션 지지가 가격을 붙잡을 수 있는 자리 — 예측이 아니라 관찰 목록입니다",
        "Where options support could catch price — a watchlist, not a forecast",
      ),
      sections,
    );
  }

  // One unlabelled section: the heading above it already says what it is.
  const plain = (picks: StockData[]): DailySection[] => [
    { title: "", note: "", picks: picks.map((stock) => ({ stock })) },
  ];

  // No levels on the board at all. On the Saturday state there is no result to
  // show either — every z is 0 by construction — so the card falls back to the
  // ranges for the week ahead rather than reporting a board of flat readings.
  if (bandElapsed === 0) {
    return digest(
      pick(locale, "이번 주 expected move 상위", "This week's widest expected moves"),
      pick(
        locale,
        "밴드가 방금 설정됐습니다 — 결과가 아닌 범위입니다",
        "The band was just struck — these are the ranges, not results",
      ),
      plain(
        [...stocks]
          .sort((a, b) => b.sigmaPercent - a.sigmaPercent)
          .slice(0, DAILY_LIMIT),
      ),
    );
  }

  const byDistance = [...stocks].sort(
    (a, b) => Math.abs(b.zScore) - Math.abs(a.zScore),
  );
  const breakouts = byDistance.filter(
    (stock) => Math.abs(stock.zScore) >= SIGMA_1,
  );

  if (breakouts.length > 0) {
    return digest(
      pick(locale, "오늘의 ±1σ 이탈 종목", "Today's ±1σ breakouts"),
      pick(
        locale,
        "각자의 주간 implied range 밖에서 거래되는 종목",
        "Names trading outside their own weekly implied range",
      ),
      plain(breakouts.slice(0, DAILY_LIMIT)),
    );
  }

  return digest(
    pick(locale, "오늘 ±1σ 이탈 없음", "Nothing past ±1σ today"),
    pick(
      locale,
      "보드가 범위 안에 머물렀습니다 — 경계에 가장 가까운 종목",
      "The board stayed inside its range — closest to the edge",
    ),
    plain(byDistance.slice(0, DAILY_LIMIT)),
  );
}

/** Rejects anything that is not a plain calendar date, before it reaches a lookup. */
export function isCalendarDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
