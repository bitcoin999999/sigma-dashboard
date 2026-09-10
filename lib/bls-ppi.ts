import { easternDate, easternInstant } from "./calendar-state";

const BLS_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
const TIMEOUT_MS = 5_000;

const SERIES = {
  PPI: "WPSFD4",
  "Core PPI": "WPSFD49104",
} as const;

type PpiName = keyof typeof SERIES;

interface BlsPoint {
  year?: string;
  period?: string;
  value?: string;
  latest?: string;
}

interface BlsSeries {
  seriesID?: string;
  data?: BlsPoint[];
}

interface BlsResponse {
  status?: string;
  Results?: { series?: BlsSeries[] };
}

interface PpiEvent {
  date: string;
  timeEt: string;
  name: string;
  actual: string | null;
  actualSource?: "nasdaq" | "bls";
}

function monthKey(year: number, month: number): string {
  return `${year}-M${String(month).padStart(2, "0")}`;
}

/** The PPI released in a calendar month normally describes the prior month. */
function referenceMonths(releaseDate: string): { current: string; previous: string } | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(releaseDate);
  if (!match) return null;
  const releaseYear = Number(match[1]);
  const releaseMonth = Number(match[2]);
  if (releaseMonth < 1 || releaseMonth > 12) return null;

  const current = new Date(Date.UTC(releaseYear, releaseMonth - 2, 1));
  const previous = new Date(Date.UTC(releaseYear, releaseMonth - 3, 1));
  return {
    current: monthKey(current.getUTCFullYear(), current.getUTCMonth() + 1),
    previous: monthKey(previous.getUTCFullYear(), previous.getUTCMonth() + 1),
  };
}

function pointKey(point: BlsPoint): string | null {
  if (!/^\d{4}$/.test(point.year ?? "") || !/^M\d{2}$/.test(point.period ?? "")) return null;
  return `${point.year}-${point.period}`;
}

function oneMonthChange(points: BlsPoint[], releaseDate: string): string | null {
  const expected = referenceMonths(releaseDate);
  if (!expected) return null;
  const byMonth = new Map(points.map(point => [pointKey(point), point]));
  const current = byMonth.get(expected.current);
  const previous = byMonth.get(expected.previous);

  // This guard is critical: before release, BLS still returns last month's
  // observation as latest. Never mistake that stale value for today's print.
  if (!current || current.latest !== "true" || !previous) return null;
  const currentValue = Number(current.value);
  const previousValue = Number(previous.value);
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue) || previousValue === 0) return null;

  const rounded = Number((((currentValue / previousValue) - 1) * 100).toFixed(1));
  return `${(Object.is(rounded, -0) ? 0 : rounded).toFixed(1)}%`;
}

/** Parse only the two official seasonally-adjusted series used by this panel. */
export function parseBlsPpiActuals(body: unknown, releaseDate: string): Partial<Record<PpiName, string>> {
  const payload = body as BlsResponse | null;
  if (payload?.status !== "REQUEST_SUCCEEDED" || !Array.isArray(payload.Results?.series)) return {};

  const out: Partial<Record<PpiName, string>> = {};
  for (const name of Object.keys(SERIES) as PpiName[]) {
    const series = payload.Results.series.find(item => item.seriesID === SERIES[name]);
    const actual = series?.data ? oneMonthChange(series.data, releaseDate) : null;
    if (actual !== null) out[name] = actual;
  }
  return out;
}

function needsFallback(event: PpiEvent, now: Date): event is PpiEvent & { name: PpiName } {
  if (!(event.name in SERIES) || event.actual !== null || event.date !== easternDate(now)) return false;
  const release = easternInstant(event.date, event.timeEt);
  return release !== null && now.getTime() >= release.getTime();
}

/**
 * Fill only missing, already-due PPI prints. Nasdaq remains primary and BLS
 * failures leave the original rows untouched.
 */
export async function applyBlsPpiFallback<T extends PpiEvent>(events: T[], now = new Date()): Promise<T[]> {
  const pending = events.filter(event => needsFallback(event, now));
  if (pending.length === 0) return events;

  const releaseDate = pending[0].date;
  try {
    const startYear = String(Number(releaseDate.slice(0, 4)) - 1);
    const endYear = releaseDate.slice(0, 4);
    const response = await fetch(BLS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ seriesid: Object.values(SERIES), startyear: startYear, endyear: endYear }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return events;
    const actuals = parseBlsPpiActuals(await response.json(), releaseDate);
    return events.map(event => {
      if (!needsFallback(event, now)) return event;
      const actual = actuals[event.name];
      return actual === undefined ? event : { ...event, actual, actualSource: "bls" as const };
    });
  } catch {
    return events;
  }
}
