import type { CalendarDay, EarningsEvent, EconEvent, WeekCalendar } from "./econ-calendar";
import type { Locale } from "./i18n";

const ET_ZONE = "America/New_York";
const KST_ZONE = "Asia/Seoul";
const zoneParts = new Map<string, Intl.DateTimeFormat>();

export function partsIn(timeZone: string, at: Date): Record<string, number> {
  let formatter = zoneParts.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    zoneParts.set(timeZone, formatter);
  }

  const out: Record<string, number> = {};
  for (const part of formatter.formatToParts(at)) {
    if (part.type !== "literal") out[part.type] = Number(part.value);
  }
  return out;
}

/** How far `timeZone` runs ahead of UTC at `at`, in milliseconds. */
function zoneOffsetMs(timeZone: string, at: Date): number {
  const p = partsIn(timeZone, at);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  // `partsIn` formats to the minute, so compare against a minute-truncated
  // instant or the seconds it dropped come back as offset error.
  return wall - Math.floor(at.getTime() / 60_000) * 60_000;
}

/**
 * An ET wall-clock date and time as a real instant.
 *
 * Solved by iteration rather than a hardcoded −4/−5: the offset depends on the
 * date, and a DST slip would put every KST time on this panel an hour out for
 * half the year. Two passes is enough — the first guess is never more than an
 * hour off, so the second lands on the right offset.
 */
export function easternInstant(date: string, hhmm: string): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;

  const [y, m, d] = date.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, Number(match[1]), Number(match[2]));

  let instant = new Date(naive);
  for (let pass = 0; pass < 2; pass += 1) {
    instant = new Date(naive - zoneOffsetMs(ET_ZONE, instant));
  }
  return instant;
}


export function easternDate(at: Date): string {
  return calendarDate(at, "en");
}

export function calendarZone(locale: Locale): string {
  return locale === "ko" ? KST_ZONE : ET_ZONE;
}

export function calendarZoneLabel(locale: Locale): "KST" | "ET" {
  return locale === "ko" ? "KST" : "ET";
}

export function calendarDate(at: Date, locale: Locale): string {
  const p = partsIn(calendarZone(locale), at);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Display-only conversion: keep the provider's ET date for release scoring. */
export function eventDisplayTime(event: EconEvent, locale: Locale) {
  const instant = easternInstant(event.date, event.timeEt);
  // A date without a time cannot be converted to one unambiguous Korean date.
  if (!instant) return { date: event.date, time: "", zone: "ET" as const };
  const p = partsIn(calendarZone(locale), instant);
  return {
    date: calendarDate(instant, locale),
    time: `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`,
    zone: calendarZoneLabel(locale),
  };
}

export function earningsDisplayDate(event: EarningsEvent, locale: Locale) {
  if (locale === "en" || event.session === "UNKNOWN") return { date: event.date, zone: "ET" as const };
  // US pre-market is the same Korean date; after-market is the following one.
  // Session boundaries resolve the date only, never invent a release time.
  const boundary = easternInstant(event.date, event.session === "AFTER" ? "16:00" : "09:30")!;
  return { date: calendarDate(boundary, locale), zone: "KST" as const };
}

export interface CalendarDisplayDay {
  date: string;
  events: EconEvent[];
  earnings: EarningsEvent[];
  /** Original ET feed status, including the prior ET day that overlaps KST. */
  sources: CalendarDay[];
}

export function calendarDisplayDays(calendar: WeekCalendar, locale: Locale): CalendarDisplayDay[] {
  const days = new Map<string, CalendarDisplayDay>();
  const getDay = (date: string) => {
    let day = days.get(date);
    if (!day) {
      day = { date, events: [], earnings: [], sources: [] };
      days.set(date, day);
    }
    return day;
  };
  const followingDate = (date: string) => calendarDate(easternInstant(date, "16:00")!, "ko");

  for (const source of calendar.days) {
    getDay(source.date);
    for (const event of source.events) getDay(eventDisplayTime(event, locale).date).events.push(event);
    for (const event of source.earnings) getDay(earningsDisplayDate(event, locale).date).earnings.push(event);
    // Unknown missing events may fall on the following Korean morning too.
    if (locale === "ko" && (source.macroStatus === "error" || source.earningsStatus === "error")) {
      getDay(followingDate(source.date));
    }
  }
  for (const day of days.values()) {
    day.sources = calendar.days.filter(source => source.date === day.date ||
      (locale === "ko" && followingDate(source.date) === day.date));
    day.events.sort((a, b) => eventDisplayTime(a, locale).time.localeCompare(eventDisplayTime(b, locale).time));
    day.earnings.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export type ReleaseState = "scheduled" | "received" | "unconfirmed" | "elapsed" | "all-day";

// A wall clock passing is not evidence that a release or speech happened.
export function releaseState(event: EconEvent, now: number): ReleaseState {
  if (event.kind === "print" && event.actual !== null) return "received";
  const instant = easternInstant(event.date, event.timeEt);
  if (!instant) return event.date < easternDate(new Date(now)) ? "elapsed" : "all-day";
  if (instant.getTime() > now) return "scheduled";
  return event.kind === "print" ? "unconfirmed" : "elapsed";
}

export function keySchedule(calendar: WeekCalendar, now: number) {
  const events = calendar.days.flatMap(day => day.events).filter(event => event.tier === 1);
  const upcoming = events.filter(event => releaseState(event, now) === "scheduled")
    .sort((a, b) => easternInstant(a.date, a.timeEt)!.getTime() - easternInstant(b.date, b.timeEt)!.getTime());
  const first = upcoming[0];
  return {
    next: first ? upcoming.filter(event => event.date === first.date && event.timeEt === first.timeEt) : [],
    unconfirmed: events.filter(event => releaseState(event, now) === "unconfirmed"),
    allDay: events.filter(event => releaseState(event, now) === "all-day"),
    incomplete: calendar.days.some(day => day.macroStatus !== "ok"),
  };
}

export const SESSION_LABEL = { PRE: "Pre", AFTER: "After", UNKNOWN: "Session not provided" } as const;

/** Keep the last successful value per feed, never erase a failure marker. */
export function retainCalendar(next: WeekCalendar, previous?: WeekCalendar): WeekCalendar {
  if (!previous || previous.weekStart !== next.weekStart) return next;
  return { ...next, days: next.days.map(day => {
    const old = previous.days.find(item => item.date === day.date);
    if (!old) return day;
    return { ...day,
      ...(day.macroStatus === "error" && !day.macroCheckedAt ? { events: old.events, macroCheckedAt: old.macroCheckedAt } : {}),
      ...(day.earningsStatus === "error" && !day.earningsCheckedAt ? { earnings: old.earnings, earningsCheckedAt: old.earningsCheckedAt } : {}),
    };
  }) };
}

export function eventKind(name: string): EconEvent["kind"] {
  return /^(fomc (statement|press conference|meeting minutes)|jackson hole symposium|fed chair .+ speaks)$/.test(name.trim().toLowerCase()) ? "event" : "print";
}
