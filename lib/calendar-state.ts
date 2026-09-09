import type { EconEvent, WeekCalendar } from "./econ-calendar";

const ET_ZONE = "America/New_York";
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
  const p = partsIn(ET_ZONE, at);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
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
