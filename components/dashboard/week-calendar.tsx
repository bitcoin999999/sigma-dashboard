"use client";

import * as React from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import type { CalendarDay, EarningsEvent, EconEvent, WeekCalendar as CalendarData } from "@/lib/econ-calendar";
import { easternDate, keySchedule, releaseState, retainCalendar, SESSION_LABEL, type ReleaseState } from "@/lib/calendar-state";
import { cn } from "@/lib/utils";

interface WeekCalendarProps {
  calendar: CalendarData;
  bandAnchorDate: string;
  onSelect: (symbol: string, earnings: EarningsEvent) => void;
  className?: string;
}

const STATE_LABEL: Record<ReleaseState, string> = {
  scheduled: "Scheduled", received: "Released", unconfirmed: "Release unconfirmed",
  elapsed: "Scheduled time passed", "all-day": "All-day event",
};
const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

export function WeekCalendar({ calendar: initial, bandAnchorDate, onSelect, className }: WeekCalendarProps) {
  const [calendar, setCalendar] = React.useState(initial);
  const [now, setNow] = React.useState(() => Date.parse(initial.checkedAt));
  const [showPrevious, setShowPrevious] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const pending = React.useRef<AbortController | null>(null);
  const refresh = React.useCallback(async () => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    setRefreshing(true);
    try {
      const response = await fetch(`/api/calendar?anchor=${encodeURIComponent(bandAnchorDate)}`, {
        cache: "no-store", signal: controller.signal,
      });
      if (response.status === 409) throw new Error("The band week has changed. Reload the page.");
      if (!response.ok) throw new Error("Calendar refresh failed · showing previous data.");
      const next = await response.json() as CalendarData;
      setCalendar(old => retainCalendar(next, old));
      setError(null);
    } catch (cause) {
      if (pending.current === controller) {
        setError(cause instanceof Error && cause.name !== "AbortError" ? cause.message : "Calendar refresh failed · showing previous data.");
      }
    } finally {
      window.clearTimeout(timeout);
      if (pending.current === controller) {
        pending.current = null;
        setRefreshing(false);
      }
    }
  }, [bandAnchorDate]);

  React.useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 15_000);
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 60_000);
    const resume = () => { if (document.visibilityState === "visible") { setNow(Date.now()); void refresh(); } };
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.clearInterval(tick); window.clearInterval(poll);
      document.removeEventListener("visibilitychange", resume);
      const controller = pending.current; pending.current = null; controller?.abort();
    };
  }, [refresh]);

  const today = easternDate(new Date(now));
  const key = keySchedule(calendar, now);
  const partial = calendar.days.some(day => day.macroStatus === "error" || day.earningsStatus === "error");
  const timestamps = calendar.days.flatMap(day => [day.macroCheckedAt, day.earningsCheckedAt]).filter((value): value is string => value !== null);
  const oldest = timestamps.sort()[0];
  const next = key.next[0];

  return (
    <aside id="week-calendar" lang="en" aria-label="This week’s macro and earnings calendar" className={cn("glass scroll-mt-28 p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold">This week</h2>
          <span className="num text-xs text-muted-foreground">{dateLabel(calendar.weekStart)} – {dateLabel(calendar.weekEnd)} · Dates in ET</span>
        </div>
        <div className="flex items-center gap-2">
        <button type="button" aria-pressed={showPrevious} onClick={() => setShowPrevious(!showPrevious)} className={cn("min-h-11 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground min-[1180px]:min-h-8", focus)}>{showPrevious ? "Hide previous" : "Show previous"}</button>
        <button type="button" onClick={() => void refresh()} disabled={refreshing}
          className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60 min-[1180px]:min-h-8", focus)}>
          <RefreshCw aria-hidden className={cn("size-3.5", refreshing && "animate-spin")} />
          {refreshing ? "Checking" : "Refresh calendar"}
        </button>
        </div>
      </div>

      <div className="mt-3 border-y border-border py-3" aria-live="polite">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <span className={cn("shrink-0 text-xs font-semibold", next ? "text-primary" : "text-muted-foreground")}>Next key event</span>
          {next ? <>
            <p className="text-base leading-6 font-semibold">{key.next.map(event => event.name).join(" / ")}</p>
            <p className="num text-xs text-muted-foreground">{weekday(next.date)} {dateLabel(next.date)} · {kstLabel(next)}</p>
            <span className="text-xs text-primary">Scheduled{key.incomplete || error ? " · available data" : ""}</span>
          </> : <p className="text-sm font-medium">{key.incomplete || error ? "Key event coverage is incomplete" : key.allDay.length ? `Time unspecified · ${key.allDay.map(event => event.name).join(" / ")}` : "No upcoming key events in available data"}</p>}
        </div>
        {key.unconfirmed.length > 0 && <p className="mt-2 text-xs font-medium">Release unconfirmed · {key.unconfirmed.map(event => event.name).join(" / ")}</p>}
        {key.allDay.length > 0 && next && <p className="mt-2 text-xs">All-day key events · {key.allDay.map(event => event.name).join(" / ")}</p>}
        {(partial || error) && <p className="mt-2 text-xs font-medium">{error ?? "Some feeds are unavailable · check each day’s data status."}</p>}
      </div>

      <ol className="mt-4 grid grid-cols-1 gap-x-5 gap-y-3 min-[1180px]:grid-cols-5">
        {calendar.days.map(day => <DayColumn key={day.date} day={day} now={now} today={today} onSelect={onSelect} showPrevious={showPrevious} />)}
      </ol>
      <footer className="mt-4 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
        <p>Selected macro · up to 5 per day · times are scheduled</p>
        <p className="num">{oldest ? `Data as of ${checkedLabel(oldest)} KST` : "No data received"} · Auto-check</p>
      </footer>
    </aside>
  );
}

function DayColumn({ day, now, today, onSelect, showPrevious }: {
  day: CalendarDay; now: number; today: string; showPrevious: boolean; onSelect: WeekCalendarProps["onSelect"];
}) {
  const [expanded, setExpanded] = React.useState<boolean | null>(null);
  const uncertain = day.events.some(event => event.tier === 1 && releaseState(event, now) === "unconfirmed");
  const failed = day.macroStatus === "error" || day.earningsStatus === "error";
  const hasRows = day.events.length > 0 || day.earnings.length > 0 || failed;
  const open = expanded ?? (day.date >= today || uncertain || failed);
  const groups = new Map<string, EconEvent[]>();
  for (const event of day.events) groups.set(event.timeEt, [...(groups.get(event.timeEt) ?? []), event]);
  const received = day.events.filter(event => releaseState(event, now) === "received").length;
  const title = <><span className={cn("num text-sm font-semibold", day.date === today && "rounded bg-foreground px-1.5 py-0.5 text-background")}>{weekday(day.date)} {dateLabel(day.date)}</span>{day.date === today && <span className="ml-auto text-xs font-medium">Today · ET</span>}</>;
  return (
    <li className="min-w-0 border-b border-border pb-3 last:border-b-0 min-[1180px]:row-span-3 min-[1180px]:grid min-[1180px]:grid-rows-subgrid min-[1180px]:border-b-0 min-[1180px]:pb-0">
      <div>
        <div className="hidden min-h-9 items-center gap-2 border-b border-border pb-2 min-[1180px]:flex">{title}</div>
        <button type="button" aria-expanded={hasRows ? open : undefined} aria-controls={hasRows ? `day-${day.date} earnings-${day.date}` : undefined}
          disabled={!hasRows} onClick={() => setExpanded(!open)}
          className={cn("flex min-h-11 w-full items-center gap-2 text-left min-[1180px]:hidden", focus)}>
          {title}{hasRows && <ChevronDown aria-hidden className={cn("ml-auto size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />}
        </button>
        {!open && hasRows && <p className="pb-1 text-xs leading-5 text-muted-foreground min-[1180px]:hidden">{day.macroStatus === "error" ? "Macro feed unavailable" : received > 0 ? `${received} released` : `${day.events.length} macro`} · {day.earningsStatus === "error" ? "Earnings feed unavailable" : `${day.earnings.length} earnings`}{day.events.some(event => event.tier === 1) && ` · ${day.events.filter(event => event.tier === 1).map(event => event.name).join(" / ")}`}</p>}
      </div>
      <div id={`day-${day.date}`} className={cn(!open && hasRows ? "hidden" : "block", "min-[1180px]:block")}>
        {day.macroStatus === "error" && <FeedError name="Macro" at={day.macroCheckedAt} />}
        {day.events.length === 0 && day.macroStatus === "ok" && <p className="py-1 text-xs text-muted-foreground">No scheduled events</p>}
        <div className="space-y-4">
          {[...groups].map(([time, events]) => {
            const states = [...new Set(events.map(event => releaseState(event, now)))];
            return <section key={time} aria-label={`${time || "All day"} Macro`}>
              <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="num text-xs leading-4 text-muted-foreground">{time ? <><span className="whitespace-nowrap">{kstLabel(events[0])}</span><span className="ml-2 whitespace-nowrap">{time} ET</span></> : "All day"}</p>
                {states.length === 1 && <StateLabel state={states[0]} important={events.some(event => event.tier === 1)} />}
              </div>
              <ul className="space-y-3">{events.map(event => <EventRow key={event.name} event={event} now={now} showPrevious={showPrevious} showState={states.length > 1} />)}</ul>
            </section>;
          })}
        </div>
      </div>
      <div id={`earnings-${day.date}`} className={cn(!open ? "hidden" : "block", "min-[1180px]:block")}>
        {(day.earnings.length > 0 || day.earningsStatus === "error") && <div className="mt-3 border-t border-border pt-3 min-[1180px]:mt-0">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Tracked earnings</p>
          {day.earningsStatus === "error" && <FeedError name="Earnings" at={day.earningsCheckedAt} />}
          <div className="flex flex-wrap gap-2">{day.earnings.map(entry => <button key={entry.symbol} type="button"
            onClick={() => onSelect(entry.symbol, entry)} aria-label={`${entry.symbol} ${SESSION_LABEL[entry.session]} earnings details`}
            className={cn("num inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-2.5 text-sm font-semibold hover:bg-muted min-[1180px]:min-h-9", focus)}>
            {entry.symbol}{entry.session !== "UNKNOWN" && <span className="text-xs font-normal text-muted-foreground">{SESSION_LABEL[entry.session]}</span>}
          </button>)}</div>
        </div>}
      </div>
    </li>
  );
}

function EventRow({ event, now, showState, showPrevious }: { event: EconEvent; now: number; showState: boolean; showPrevious: boolean }) {
  const state = releaseState(event, now);
  return <li>
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <p className={cn("text-sm leading-5 text-foreground", event.tier === 1 ? "font-semibold" : "font-normal")}>{event.name}</p>
      {showState && <StateLabel state={state} important={event.tier === 1} />}
    </div>
    {event.kind === "print" && <>
      {(event.actual !== null || event.forecast !== null || event.previous !== null) && <p className="num mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs leading-5 text-muted-foreground">
        {event.actual !== null && <span>Actual <strong className="text-sm font-semibold text-foreground">{event.actual}</strong></span>}
        {event.forecast !== null ? <span>Est <span className="text-foreground">{event.forecast}</span></span> : event.actual !== null ? <span>No estimate</span> : event.previous !== null ? <span>Prev {event.previous}</span> : null}
      </p>}
      {showPrevious && event.previous !== null && (event.actual !== null || event.forecast !== null) && <p className="num mt-1 text-xs leading-5 text-muted-foreground">Prev {event.previous}</p>}
    </>}
  </li>;
}

function StateLabel({ state, important }: { state: ReleaseState; important: boolean }) {
  return <span className={cn("text-xs leading-4", state === "scheduled" && important ? "font-medium text-primary" : state === "unconfirmed" ? "font-medium text-foreground" : "text-muted-foreground")}>{STATE_LABEL[state]}</span>;
}
function FeedError({ name, at }: { name: string; at: string | null }) {
  return <p className="mb-2 text-xs leading-5 font-medium">{name} feed unavailable{at && <span className="block font-normal text-muted-foreground">Previous data · {checkedLabel(at)} KST</span>}</p>;
}
function weekday(date: string) { return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }); }
function dateLabel(date: string) { const [, month, day] = date.split("-"); return `${Number(month)}/${Number(day)}`; }
function kstLabel(event: EconEvent) { return `${event.kstNextDay ? "Next day " : ""}${event.timeKst} KST`; }
function checkedLabel(at: string) { return new Date(at).toLocaleString("en-US", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); }
