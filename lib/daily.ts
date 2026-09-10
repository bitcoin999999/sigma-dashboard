import { SIGMA_1 } from "@/lib/sigma";
import type { StockData } from "@/lib/types";
import { pick, type Locale } from "@/lib/i18n";

/** Rows on the share card. Any more and the 1200×630 frame stops being legible. */
export const DAILY_LIMIT = 5;

export interface DailyDigest {
  /** Headline. The page and the share image must say the same thing. */
  heading: string;
  /** One line saying what the list selected for. */
  subheading: string;
  stocks: StockData[];
}

/**
 * The handful of names worth putting on a card for one session.
 *
 * Three cases, because "nothing is past ±1σ" is a real and common result and
 * an empty card says nothing. On the Saturday state there is no result to show
 * at all — every z is 0 by construction — so the card falls back to the ranges
 * for the week ahead rather than reporting a board of flat readings.
 */
export function buildDailyDigest(
  stocks: StockData[],
  bandElapsed: number,
  locale: Locale = "en",
): DailyDigest {
  if (bandElapsed === 0) {
    return {
      heading: pick(locale, "이번 주 expected move 상위", "This week's widest expected moves"),
      subheading: pick(locale, "밴드가 방금 설정됐습니다 — 결과가 아닌 범위입니다", "The band was just struck — these are the ranges, not results"),
      stocks: [...stocks]
        .sort((a, b) => b.sigmaPercent - a.sigmaPercent)
        .slice(0, DAILY_LIMIT),
    };
  }

  const byDistance = [...stocks].sort(
    (a, b) => Math.abs(b.zScore) - Math.abs(a.zScore),
  );
  const breakouts = byDistance.filter(
    (stock) => Math.abs(stock.zScore) >= SIGMA_1,
  );

  if (breakouts.length > 0) {
    return {
      heading: pick(locale, "오늘의 ±1σ 이탈 종목", "Today's ±1σ breakouts"),
      subheading: pick(locale, "각자의 주간 implied range 밖에서 거래되는 종목", "Names trading outside their own weekly implied range"),
      stocks: breakouts.slice(0, DAILY_LIMIT),
    };
  }

  return {
    heading: pick(locale, "오늘 ±1σ 이탈 없음", "Nothing past ±1σ today"),
    subheading: pick(locale, "보드가 범위 안에 머물렀습니다 — 경계에 가장 가까운 종목", "The board stayed inside its range — closest to the edge"),
    stocks: byDistance.slice(0, DAILY_LIMIT),
  };
}

/** Rejects anything that is not a plain calendar date, before it reaches a lookup. */
export function isCalendarDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
