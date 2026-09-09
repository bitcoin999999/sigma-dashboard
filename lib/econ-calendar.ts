import { easternInstant, easternDate, partsIn, retainCalendar, eventKind } from "./calendar-state";

/**
 * The week's scheduled catalysts: macro prints and, for tracked names, earnings.
 *
 * Separate from the snapshot on purpose. The snapshot is settled closes written
 * once a day by the publisher; a release that lands at 08:30 ET has to show its
 * actual within the hour or the panel is decoration. So this is a second feed on
 * its own short TTL, exactly like `lib/live-quotes.ts` — and like that one, it
 * never feeds a σ figure.
 *
 * The upstream is Nasdaq's public calendar. It is the only free source found
 * that carries an *actual* alongside consensus and previous; the options vendor
 * this project already uses publishes forecast and previous but never fills in
 * the print, which makes it useless for the column that matters most.
 */

const ECON_URL = "https://api.nasdaq.com/api/calendar/economicevents";
const EARNINGS_URL = "https://api.nasdaq.com/api/calendar/earnings";

const TIMEOUT_MS = 8_000;

/**
 * How long one upstream read is reused. Short because the actual column is the
 * point: a CPI print that shows up ten minutes late is fine, an hour late is
 * not.
 */
const TTL_MS = 10 * 60_000;

/**
 * TTL for a week that came back with a day missing. A single failed day still
 * renders — but caching that hole for the full {@link TTL_MS} once hid a CPI
 * Friday behind "No scheduled prints" for ten minutes, so it expires fast
 * enough that the next request refetches.
 */
const PARTIAL_TTL_MS = 30_000;

/**
 * Nasdaq drops the connection mid-stream for anything that does not look like a
 * browser — a self-identifying agent string fails, and it fails as a transport
 * error rather than a status code, so it reads as the vendor being down.
 */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const ET_ZONE = "America/New_York";
const KST_ZONE = "Asia/Seoul";

/** How many macro rows one day can show before the panel stops being scannable. */
const EVENTS_PER_DAY = 5;

export interface EconEvent {
  /** ET calendar date the release belongs to, `YYYY-MM-DD`. */
  date: string;
  /** 24-hour ET clock, e.g. `08:30`. Empty for all-day entries. */
  timeEt: string;
  /** Same instant on a Seoul clock. Empty whenever `timeEt` is. */
  timeKst: string;
  /**
   * Whether the Seoul clock has already rolled past midnight — an afternoon ET
   * release is the next morning in Korea, and a bare "03:00" beside "14:00"
   * reads as a typo without this.
   */
  kstNextDay: boolean;
  name: string;
  /** 1 is a release that moves the whole tape; 2 is worth knowing about. */
  tier: 1 | 2;
  /** Null means no vendor value, not proof that the release is still ahead. */
  kind: "print" | "event";
  actual: string | null;
  forecast: string | null;
  previous: string | null;
}

export interface EarningsEvent {
  date: string;
  symbol: string;
  name: string;
  session: "PRE" | "AFTER" | "UNKNOWN";
  epsForecast: string | null;
}

export interface CalendarDay {
  date: string;
  events: EconEvent[];
  earnings: EarningsEvent[];
  macroStatus: "ok" | "error";
  earningsStatus: "ok" | "error";
  macroCheckedAt: string | null;
  earningsCheckedAt: string | null;
}

export interface WeekCalendar {
  /** Monday and Friday of the week, as ET calendar dates. */
  weekStart: string;
  weekEnd: string;
  /** Today on an ET clock, so the client can mark the row without doing zone maths. */
  todayEt: string;
  days: CalendarDay[];
  checkedAt: string;
}

/**
 * The releases worth putting on a page about weekly ranges.
 *
 * Curated by hand rather than filtered by an "impact" flag, because the feed
 * carries several hundred US rows a week — bill auctions, regional Fed indices,
 * CFTC positioning — and an unfiltered list buries CPI under crude inventories.
 * Keys are lowercased upstream names; the display name is the upstream one, so
 * nothing here can quietly relabel a series as something it is not.
 */
const TRACKED: Record<string, 1 | 2> = {
  // Policy
  "fed interest rate decision": 1,
  "fomc statement": 1,
  "fomc press conference": 1,
  "fomc meeting minutes": 1,
  "jackson hole symposium": 1,

  // Prices
  cpi: 1,
  "core cpi": 1,
  ppi: 1,
  "core ppi": 1,
  "pce price index": 1,
  "core pce price index": 1,
  "michigan 1-year inflation expectations": 2,
  "ny fed 1-year consumer inflation expectations": 2,

  // Labour
  "nonfarm payrolls": 1,
  "unemployment rate": 1,
  "average hourly earnings": 1,
  "adp nonfarm employment change": 2,
  "initial jobless claims": 2,
  "jolts job openings": 2,
  "challenger job cuts": 2,

  // Activity
  gdp: 1,
  "retail sales": 1,
  "core retail sales": 1,
  "ism manufacturing pmi": 2,
  "ism non-manufacturing pmi": 2,
  "cb consumer confidence": 2,
  "michigan consumer sentiment": 2,
};

/** Whoever chairs the Fed, by title rather than by name, so it survives a handover. */
const FED_CHAIR = /^fed chair .+ speaks$/;

interface EconRow {
  gmt?: string;
  country?: string;
  eventName?: string;
  actual?: string;
  consensus?: string;
  previous?: string;
}

interface EarningsRow {
  symbol?: string;
  name?: string;
  time?: string;
  epsForecast?: string;
}

async function loadJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    // The page rendering this is force-dynamic, which turns off fetch caching
    // for everything under it. The module TTL below is what absorbs load.
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Calendar feed returned ${response.status}.`);
  }

  return response.json();
}

function rowsOf<T>(body: unknown): T[] {
  const payload = body as {
    data?: { rows?: unknown } | null;
    status?: { rCode?: number; bCodeMessage?: { code?: number; errorMessage?: string }[] };
  } | null;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows as T[];
  // User policy: the vendor's explicit "No record found" means no scheduled
  // events. Unexplained null payloads and transport failures remain errors.
  if (payload?.status?.rCode === 200 && Array.isArray(payload.status.bCodeMessage) &&
      payload.status.bCodeMessage.some(message => message.code === 1002 &&
        /no records? found/i.test(message.errorMessage ?? ""))) return [];
  throw new Error("Calendar rows unavailable.");
}

/** Upstream writes an empty cell as a single space, `N/A`, or nothing at all. */
/**
 * An unpublished figure comes back as blank in several spellings — a space, a
 * dash, a literal `&nbsp;` entity, a real non-breaking space. All of them mean
 * the same thing and all of them have to collapse to null, or the em dash that
 * marks "not out yet" is replaced by visible whitespace.
 */
function cell(value: string | undefined): string | null {
  const text = value
    ?.replace(/&nbsp;| /g, " ")
    .trim();
  if (!text || /^(?:N\/A|[-—–])$/i.test(text)) return null;
  return text;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** ET `08:30` on `date` → the Seoul clock reading, and whether it crossed midnight. */
function seoulTime(
  date: string,
  timeEt: string,
): { timeKst: string; kstNextDay: boolean } {
  const instant = easternInstant(date, timeEt);
  if (!instant) return { timeKst: "", kstNextDay: false };

  const kst = partsIn(KST_ZONE, instant);
  const et = partsIn(ET_ZONE, instant);

  return {
    timeKst: `${pad(kst.hour)}:${pad(kst.minute)}`,
    kstNextDay: kst.day !== et.day,
  };
}

/** The release's rank, or null when it is not one this board carries. */
function tierOf(name: string): 1 | 2 | null {
  const key = name.trim().toLowerCase();
  return TRACKED[key] ?? (FED_CHAIR.test(key) ? 1 : null);
}

/**
 * The economic feed is keyed a day ahead of the session it describes: August
 * payrolls printed Friday 2026-09-04 and come back under `date=2026-09-05`, and
 * the same shift holds for Labor Day, NFIB and jobless claims. Asking for the
 * day after is what puts a release on the day it actually happened.
 *
 * The earnings feed is not shifted — its weekends come back empty — so this
 * correction belongs here and not in `loadJson`.
 */
async function loadEconDay(date: string): Promise<EconEvent[]> {
  const rows = rowsOf<EconRow>(await loadJson(`${ECON_URL}?date=${dayAfter(date)}`));

  const events: EconEvent[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (row.country !== "United States") continue;

    const name = row.eventName?.trim();
    if (!name) continue;

    const tier = tierOf(name);
    if (!tier) continue;

    // The feed carries near-duplicate spellings of the same series in the same
    // slot ("PCE Price index" and "PCE price index"). Keep the first.
    const key = `${name.toLowerCase()}@${row.gmt ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Despite the field name this is an ET clock reading, verified against
    // releases whose time is fixed by statute: payrolls print at 08:30 ET and
    // arrive here as "08:30". Non-clock values ("All Day") pass through empty.
    const timeEt = /^\d{1,2}:\d{2}$/.test(row.gmt ?? "") ? row.gmt! : "";

    events.push({
      date,
      timeEt,
      ...seoulTime(date, timeEt),
      name,
      tier,
      kind: eventKind(name),
      actual: cell(row.actual),
      forecast: cell(row.consensus),
      previous: cell(row.previous),
    });
  }

  // Rank before trimming so a capped day drops a jobless-claims line rather
  // than the CPI print sitting in the same 08:30 slot.
  events.sort((a, b) => a.tier - b.tier || a.timeEt.localeCompare(b.timeEt));

  return events
    .slice(0, EVENTS_PER_DAY)
    .sort((a, b) => a.timeEt.localeCompare(b.timeEt) || a.tier - b.tier);
}

async function loadEarningsDay(
  date: string,
  tracked: Set<string>,
): Promise<EarningsEvent[]> {
  const rows = rowsOf<EarningsRow>(await loadJson(`${EARNINGS_URL}?date=${date}`));

  const out: EarningsEvent[] = [];

  for (const row of rows) {
    const symbol = row.symbol?.trim().toUpperCase();
    if (!symbol || !tracked.has(symbol)) continue;

    out.push({
      date,
      symbol,
      name: row.name?.trim() ?? symbol,
      session:
        row.time === "time-pre-market"
          ? "PRE"
          : row.time === "time-after-hours"
            ? "AFTER"
            : "UNKNOWN",
      epsForecast: cell(row.epsForecast),
    });
  }

  return out.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

function dayAfter(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/** The five weekdays of the week `anchorDate`'s Friday close opened. */
function weekOf(anchorDate: string): string[] {
  const start = new Date(`${anchorDate}T00:00:00Z`);
  // Walk to the next Monday. The anchor is a Friday close, so the band's first
  // traded session is the Monday after it — which is the week this panel covers.
  do {
    start.setUTCDate(start.getUTCDate() + 1);
  } while (start.getUTCDay() !== 1);

  return Array.from({ length: 5 }, (_, i) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + i);
    return day.toISOString().slice(0, 10);
  });
}

async function fetchCalendar(
  anchorDate: string,
  symbols: string[],
): Promise<{ calendar: WeekCalendar; partial: boolean }> {
  const dates = weekOf(anchorDate);
  const tracked = new Set(symbols.map((symbol) => symbol.toUpperCase()));

  const days = await Promise.all(dates.map(async (date): Promise<CalendarDay> => {
    const [macro, earnings] = await Promise.allSettled([
      loadEconDay(date), loadEarningsDay(date, tracked),
    ]);
    const checkedAt = new Date().toISOString();
    return {
      date,
      events: macro.status === "fulfilled" ? macro.value : [],
      earnings: earnings.status === "fulfilled" ? earnings.value : [],
      macroStatus: macro.status === "fulfilled" ? "ok" : "error",
      earningsStatus: earnings.status === "fulfilled" ? "ok" : "error",
      macroCheckedAt: macro.status === "fulfilled" ? checkedAt : null,
      earningsCheckedAt: earnings.status === "fulfilled" ? checkedAt : null,
    };
  }));
  return {
    calendar: {
      weekStart: dates[0], weekEnd: dates[dates.length - 1],
      todayEt: easternDate(new Date()), days, checkedAt: new Date().toISOString(),
    },
    partial: days.some(day => day.macroStatus === "error" || day.earningsStatus === "error"),
  };
}

let memo: {
  key: string;
  at: number;
  ttl: number;
  calendar: WeekCalendar;
} | null = null;

/**
 * The week's calendar, shared across requests for {@link TTL_MS} — or only
 * {@link PARTIAL_TTL_MS} when a day came back empty because its fetch threw.
 *
 * Resolves to null rather than throwing: this panel sits beside the board, and
 * a calendar vendor having a bad afternoon is not a reason to take the σ
 * dashboard down with it.
 */
export async function loadWeekCalendar(
  anchorDate: string,
  symbols: string[],
): Promise<WeekCalendar | null> {
  const key = `${anchorDate}|${[...new Set(symbols)].sort().join(",")}`;
  if (memo && memo.key === key && Date.now() - memo.at < memo.ttl) {
    return memo.calendar;
  }

  try {
    const { calendar, partial } = await fetchCalendar(anchorDate, symbols);
    const retained = retainCalendar(calendar, memo?.key === key ? memo.calendar : undefined);
    memo = {
      key,
      at: Date.now(),
      ttl: partial ? PARTIAL_TTL_MS : TTL_MS,
      calendar: retained,
    };
    return retained;
  } catch {
    return memo?.key === key ? {
      ...memo.calendar,
      days: memo.calendar.days.map(day => ({ ...day, macroStatus: "error", earningsStatus: "error" })),
    } : null;
  }
}
