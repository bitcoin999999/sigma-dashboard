import { chartWeek, parseWeeklyChart, type WeeklyChartData } from "./weekly-chart";
import { chartCacheWindow } from "./weekly-chart-refresh";

const MAX_ENTRIES = 128;
const memo = new Map<string, { expires: number; pending: Promise<WeeklyChartData> }>();

/** Per-symbol/week cache also coalesces simultaneous visitors' requests. */
export async function loadWeeklyChart(symbol: string): Promise<WeeklyChartData> {
  if (!/^[A-Z0-9^][A-Z0-9.^-]{0,11}$/.test(symbol)) throw new Error("Invalid chart symbol.");
  const now = new Date();
  const key = `${symbol}:${chartWeek(now).weekStart}`;
  const cached = memo.get(key);
  if (cached && cached.expires > now.getTime()) return cached.pending;

  const pending = (async () => {
    const query = new URLSearchParams({ range: "5d", interval: "30m", includePrePost: "false" });
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${query}`, {
      headers: { "User-Agent": "1SIGMA/1.0 (+https://sigma-dashboard-five.vercel.app)", Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Weekly chart feed returned ${response.status}.`);
    return parseWeeklyChart(await response.json(), symbol);
  })();
  if (memo.size >= MAX_ENTRIES) memo.delete(memo.keys().next().value!);
  const entry = { expires: chartCacheWindow(now).end, pending };
  memo.set(key, entry);
  try {
    return await pending;
  } catch (error) {
    // Short failure cache prevents retries from hammering an unavailable feed.
    entry.expires = Date.now() + 10_000;
    throw error;
  }
}
