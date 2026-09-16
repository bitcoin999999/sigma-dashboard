import { easternDate, partsIn } from "./calendar-state";

export const CHART_REFRESH_MS = 30 * 60_000;
const BAR_DELAY_MS = 2 * 60_000;

/** Shared browser/CDN/server window, aligned to :02 and :32 after a bar turn. */
export function chartCacheWindow(now = new Date()) {
  const start = Math.floor((now.getTime() - BAR_DELAY_MS) / CHART_REFRESH_MS) * CHART_REFRESH_MS + BAR_DELAY_MS;
  return { start, end: start + CHART_REFRESH_MS };
}

/** Local clock checks are cheap; only these checks may issue a network request. */
export function shouldRefreshChart(now: Date, lastAttempt: number | null): boolean {
  if (lastAttempt === null) return true; // One initial read, including outside trading hours.
  const day = new Date(`${easternDate(now)}T00:00:00Z`).getUTCDay();
  const { hour, minute } = partsIn("America/New_York", now);
  const minutes = hour * 60 + minute;
  // Final 16:02 check collects the closing candle; weekends do not poll.
  if (day === 0 || day === 6 || minutes < 572 || minutes > 962) return false;
  return chartCacheWindow(now).start > chartCacheWindow(new Date(lastAttempt)).start;
}

/** Expire all cache layers together; do not extend old data another 30 minutes. */
export function chartCacheSeconds(fetchedAt: string, now = new Date()): number {
  return Math.max(0, Math.floor((chartCacheWindow(new Date(fetchedAt)).end - now.getTime()) / 1000));
}
