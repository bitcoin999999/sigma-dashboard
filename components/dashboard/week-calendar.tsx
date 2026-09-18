"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";
import type { EarningsEvent, EconEvent, WeekCalendar as CalendarData } from "@/lib/econ-calendar";
import { calendarDate, calendarDisplayDays, calendarZone, calendarZoneLabel, earningsDisplayDate, eventDisplayTime, keySchedule, releaseState, retainCalendar, SESSION_LABEL, type CalendarDisplayDay, type ReleaseState } from "@/lib/calendar-state";
import { cn } from "@/lib/utils";

interface WeekCalendarProps {
  calendar: CalendarData;
  bandAnchorDate: string;
  onSelect: (symbol: string, earnings: EarningsEvent) => void;
  className?: string;
}

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

export function WeekCalendar({ calendar: initial, bandAnchorDate, onSelect, className }: WeekCalendarProps) {
  const { locale, pick } = useLocale();
  const [calendar, setCalendar] = React.useState(initial);
  const [weekOffset, setWeekOffset] = React.useState<0 | 1>(0);
  const [now, setNow] = React.useState(() => Date.parse(initial.checkedAt));
  const [showPrevious, setShowPrevious] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const pending = React.useRef<AbortController | null>(null);
  const refresh = React.useCallback(async (targetWeek: 0 | 1 = weekOffset) => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    setRefreshing(true);
    try {
      const response = await fetch(`/api/calendar?anchor=${encodeURIComponent(bandAnchorDate)}&week=${targetWeek}`, {
        cache: "no-store", signal: controller.signal,
      });
      if (response.status === 409) throw new Error(pick("밴드 주간이 바뀌었습니다. 페이지를 새로고침하세요.", "The band week has changed. Reload the page."));
      if (!response.ok) throw new Error(pick("일정 새로고침 실패 · 이전 데이터를 표시합니다.", "Calendar refresh failed · showing previous data."));
      const next = await response.json() as CalendarData;
      if (pending.current !== controller) return;
      setCalendar(old => retainCalendar(next, old));
      setWeekOffset(targetWeek);
      setError(null);
    } catch (cause) {
      if (pending.current === controller) {
        setError(cause instanceof Error && cause.name !== "AbortError" ? cause.message : pick("일정 새로고침 실패 · 이전 데이터를 표시합니다.", "Calendar refresh failed · showing previous data."));
      }
    } finally {
      window.clearTimeout(timeout);
      if (pending.current === controller) {
        pending.current = null;
        setRefreshing(false);
      }
    }
  }, [bandAnchorDate, pick, weekOffset]);

  React.useEffect(() => {
    // A cached feed timestamp can belong to yesterday. Sync on hydration,
    // without making the server/client's first render disagree.
    const frame = window.requestAnimationFrame(() => setNow(Date.now()));
    const tick = window.setInterval(() => setNow(Date.now()), 15_000);
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 60_000);
    const resume = () => { if (document.visibilityState === "visible") { setNow(Date.now()); void refresh(); } };
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(tick); window.clearInterval(poll);
      document.removeEventListener("visibilitychange", resume);
      const controller = pending.current; pending.current = null; controller?.abort();
    };
  }, [refresh]);

  const today = calendarDate(new Date(now), locale);
  const zone = calendarZoneLabel(locale);
  const days = React.useMemo(() => calendarDisplayDays(calendar, locale), [calendar, locale]);
  const key = keySchedule(calendar, now);
  const partial = calendar.days.some(day => day.macroStatus === "error" || day.earningsStatus === "error");
  const timestamps = calendar.days.flatMap(day => [day.macroCheckedAt, day.earningsCheckedAt]).filter((value): value is string => value !== null);
  const oldest = timestamps.sort()[0];
  const next = key.next[0];
  const nextDisplay = next ? eventDisplayTime(next, locale) : null;

  return (
    <aside id="week-calendar" aria-busy={refreshing} aria-label={weekOffset === 0 ? pick("이번 주 거시경제 및 실적 일정", "This week’s macro and earnings calendar") : pick("다음 주 거시경제 및 실적 일정", "Next week’s macro and earnings calendar")} className={cn("glass scroll-mt-28 p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold">{weekOffset === 0 ? pick("이번 주", "This week") : pick("다음 주", "Next week")}</h2>
          <span className="num text-xs text-muted-foreground">{dateLabel(days[0]?.date ?? calendar.weekStart)} – {dateLabel(days.at(-1)?.date ?? calendar.weekEnd)} · {pick("날짜는 KST 기준", "Dates in ET")}</span>
          <button type="button" onClick={() => void refresh(weekOffset === 0 ? 1 : 0)} disabled={refreshing}
            className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-60 min-[1180px]:min-h-8", focus)}>
            {weekOffset === 1 && <ArrowLeft aria-hidden className="size-3.5" />}
            {weekOffset === 0 ? pick("다음 주 보기", "View next week") : pick("이번 주 보기", "View this week")}
            {weekOffset === 0 && <ArrowRight aria-hidden className="size-3.5" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
        <button type="button" aria-pressed={showPrevious} onClick={() => setShowPrevious(!showPrevious)} className={cn("min-h-11 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground min-[1180px]:min-h-8", focus)}>{showPrevious ? pick("이전치 숨기기", "Hide previous") : pick("이전치 보기", "Show previous")}</button>
        <button type="button" onClick={() => void refresh()} disabled={refreshing}
          className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60 min-[1180px]:min-h-8", focus)}>
          <RefreshCw aria-hidden className={cn("size-3.5", refreshing && "animate-spin")} />
          {refreshing ? pick("확인 중", "Checking") : pick("일정 새로고침", "Refresh calendar")}
        </button>
        </div>
      </div>

      <div className="mt-3 border-y border-border py-3" aria-live="polite">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <span className={cn("shrink-0 text-xs font-semibold", next ? "text-primary" : "text-muted-foreground")}>{pick("다음 주요 일정", "Next key event")}</span>
          {next ? <>
            <p className="text-base leading-6 font-semibold">{key.next.map(event => event.name).join(" / ")}</p>
            <p className="num text-xs text-muted-foreground">{weekday(nextDisplay!.date, locale)} {dateLabel(nextDisplay!.date)} · {nextDisplay!.time} {nextDisplay!.zone}</p>
            <span className="text-xs text-primary">{pick("예정", "Scheduled")}{key.incomplete || error ? pick(" · 확인 가능한 데이터", " · available data") : ""}</span>
          </> : <p className="text-sm font-medium">{key.incomplete || error ? pick("주요 일정 데이터가 불완전합니다", "Key event coverage is incomplete") : key.allDay.length ? `${pick("시간 미지정", "Time unspecified")} · ${key.allDay.map(event => event.name).join(" / ")}` : pick("확인 가능한 데이터에 예정된 주요 일정이 없습니다", "No upcoming key events in available data")}</p>}
        </div>
        {key.unconfirmed.length > 0 && <p className="mt-2 text-xs font-medium">{pick("발표 미확인", "Release unconfirmed")} · {key.unconfirmed.map(event => event.name).join(" / ")}</p>}
        {key.allDay.length > 0 && next && <p className="mt-2 text-xs">{pick("종일 주요 일정", "All-day key events")} · {key.allDay.map(event => event.name).join(" / ")}</p>}
        {(partial || error) && <p className="mt-2 text-xs font-medium">{error ?? pick("일부 피드를 사용할 수 없습니다 · 일자별 데이터 상태를 확인하세요.", "Some feeds are unavailable · check each day’s data status.")}</p>}
      </div>

      {/* Phone: a week is five days, and on a phone five stacked accordions is
          a full screen of chevrons before the first event. The strip puts the
          whole week in one row — with a dot for a tier-1 print and a second for
          tracked earnings — and one day's detail sits open underneath it. */}
      <MobileWeek days={days} now={now} today={today} onSelect={onSelect} showPrevious={showPrevious} />

      <ol className={cn("mt-4 hidden grid-cols-1 gap-x-5 gap-y-3", days.length > 5 ? "min-[1180px]:grid min-[1180px]:grid-cols-6" : "min-[1180px]:grid min-[1180px]:grid-cols-5")}>
        {days.map(day => <DayColumn key={`${locale}-${day.date}`} day={day} now={now} today={today} onSelect={onSelect} showPrevious={showPrevious} />)}
      </ol>
      <footer className="mt-4 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
        <p>{pick("선별된 macro · ET 일자당 최대 5개 · 시각 미제공은 ET 날짜", "Selected macro · up to 5 per day · times are scheduled")}</p>
        <p className="num">{oldest ? `${pick("데이터 기준", "Data as of")} ${checkedLabel(oldest, locale)} ${zone}` : pick("수신된 데이터 없음", "No data received")} · {pick("자동 확인", "Auto-check")}</p>
      </footer>
    </aside>
  );
}

function MobileWeek({ days, now, today, onSelect, showPrevious }: {
  days: CalendarDisplayDay[]; now: number; today: string; showPrevious: boolean; onSelect: WeekCalendarProps["onSelect"];
}) {
  const { locale, pick } = useLocale();
  const [picked, setPicked] = React.useState<string | null>(null);
  // Derived with a fallback rather than synced in an effect: flipping to next
  // week replaces every date at once, and the old pick simply stops matching.
  const fallback = days.find(day => day.date >= today)?.date ?? days.at(-1)?.date ?? "";
  const active = days.some(day => day.date === picked) ? picked! : fallback;
  const day = days.find(entry => entry.date === active);
  if (!day) return null;
  const failed = day.sources.some(source => source.macroStatus === "error" || source.earningsStatus === "error");

  return (
    <div className="mt-4 min-[1180px]:hidden">
      {/* Bleeds to the card's edge so the last day does not look clipped by
          padding when the row scrolls. */}
      <div role="tablist" aria-label={pick("요일 선택", "Select a day")} className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {days.map(entry => {
          const selected = entry.date === active;
          const tier1 = entry.events.filter(event => event.tier === 1).length;
          const broken = entry.sources.some(source => source.macroStatus === "error" || source.earningsStatus === "error");
          return (
            <button key={entry.date} type="button" role="tab" aria-selected={selected} aria-controls="week-day-panel"
              onClick={() => setPicked(entry.date)}
              className={cn("flex min-h-[3.5rem] w-[3.5rem] shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors",
                selected ? "border-transparent bg-foreground text-background"
                  : entry.date === today ? "border-foreground/40 text-foreground"
                  : "border-border text-muted-foreground", focus)}>
              <span className="text-[11px] leading-4 font-medium">{weekday(entry.date, locale)}</span>
              <span className="num text-sm leading-4 font-semibold">{dateLabel(entry.date)}</span>
              {/* Two dots, not a count: a tier-1 print and tracked earnings are
                  the only two reasons to open a day from the strip. */}
              <span aria-hidden className="flex h-1.5 items-center gap-0.5">
                {tier1 > 0 && <span className={cn("size-1.5 rounded-full", selected ? "bg-background" : "bg-primary")} />}
                {entry.earnings.length > 0 && <span className={cn("size-1.5 rounded-full", selected ? "bg-background/60" : "bg-muted-foreground/60")} />}
                {broken && <span className={cn("size-1.5 rounded-full", selected ? "bg-background/60" : "bg-foreground/60")} />}
              </span>
            </button>
          );
        })}
      </div>

      <div id="week-day-panel" role="tabpanel" aria-live="polite" className="mt-4 border-t border-border pt-3">
        <div className="mb-2 flex items-center gap-2">
          <span className={cn("num text-sm font-semibold", day.date === today && "rounded bg-foreground px-1.5 py-0.5 text-background")}>{weekday(day.date, locale)} {dateLabel(day.date)}</span>
          {day.date === today && <span className="text-xs font-medium">{pick("오늘", "Today")} · {calendarZoneLabel(locale)}</span>}
          <span className="ml-auto text-xs text-muted-foreground">{failed ? pick("피드 일부 사용 불가", "Some feeds unavailable") : pick(`macro ${day.events.length} · 실적 ${day.earnings.length}`, `${day.events.length} macro · ${day.earnings.length} earnings`)}</span>
        </div>
        <DayMacro day={day} now={now} showPrevious={showPrevious} />
        <DayEarnings day={day} onSelect={onSelect} />
      </div>
    </div>
  );
}

function DayColumn({ day, now, today, onSelect, showPrevious }: {
  day: CalendarDisplayDay; now: number; today: string; showPrevious: boolean; onSelect: WeekCalendarProps["onSelect"];
}) {
  const { locale, pick } = useLocale();
  return (
    <li className="min-w-0 row-span-3 grid grid-rows-subgrid">
      <div className="flex min-h-9 items-center gap-2 border-b border-border pb-2">
        <span className={cn("num text-sm font-semibold", day.date === today && "rounded bg-foreground px-1.5 py-0.5 text-background")}>{weekday(day.date, locale)} {dateLabel(day.date)}</span>
        {day.date === today && <span className="ml-auto text-xs font-medium">{pick("오늘", "Today")} · {calendarZoneLabel(locale)}</span>}
      </div>
      <DayMacro day={day} now={now} showPrevious={showPrevious} />
      <DayEarnings day={day} onSelect={onSelect} flush />
    </li>
  );
}

function DayMacro({ day, now, showPrevious }: { day: CalendarDisplayDay; now: number; showPrevious: boolean }) {
  const { locale, pick } = useLocale();
  const macroFailures = day.sources.filter(source => source.macroStatus === "error");
  const groups = new Map<string, EconEvent[]>();
  for (const event of day.events) {
    const time = eventDisplayTime(event, locale).time;
    groups.set(time, [...(groups.get(time) ?? []), event]);
  }
  return (
    <div>
      {macroFailures.map(source => <FeedError key={source.date} name="Macro" at={source.macroCheckedAt} sourceDate={source.date} />)}
      {day.events.length === 0 && macroFailures.length === 0 && <p className="py-1 text-xs text-muted-foreground">{pick("예정된 일정 없음", "No scheduled events")}</p>}
      <div className="space-y-4">
        {[...groups].map(([time, events]) => {
          const states = [...new Set(events.map(event => releaseState(event, now)))];
          return <section key={time} aria-label={`${time || pick("종일", "All day")} Macro`}>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="num text-xs leading-4 text-muted-foreground">{time ? <EventClock event={events[0]} /> : `${pick("종일 · 시각 미제공", "All day")} · ${dateLabel(events[0].date)} ET`}</p>
              {states.length === 1 && <StateLabel state={states[0]} important={events.some(event => event.tier === 1)} />}
            </div>
            <ul className="space-y-3">{events.map(event => <EventRow key={`${event.date}-${event.timeEt}-${event.name}`} event={event} now={now} showPrevious={showPrevious} showState={states.length > 1} />)}</ul>
          </section>;
        })}
      </div>
    </div>
  );
}

function DayEarnings({ day, onSelect, flush = false }: { day: CalendarDisplayDay; onSelect: WeekCalendarProps["onSelect"]; flush?: boolean }) {
  const { locale, pick } = useLocale();
  const earningsFailures = day.sources.filter(source => source.earningsStatus === "error");
  if (day.earnings.length === 0 && earningsFailures.length === 0) return <div />;
  return (
    <div>
      <div className={cn("border-t border-border pt-3", !flush && "mt-3")}>
        <p className="mb-2 text-xs font-medium text-muted-foreground">{pick("추적 종목 실적", "Tracked earnings")}</p>
        {earningsFailures.map(source => <FeedError key={source.date} name={pick("실적", "Earnings")} at={source.earningsCheckedAt} sourceDate={source.date} />)}
        <div className="flex flex-wrap gap-2">{day.earnings.map(entry => <button key={`${entry.date}-${entry.symbol}`} type="button"
          onClick={() => onSelect(entry.symbol, entry)} aria-label={`${entry.symbol} ${SESSION_LABEL[entry.session]} ${pick("실적 상세", "earnings details")}`}
          className={cn("num inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-2.5 text-sm font-semibold hover:bg-muted min-[1180px]:min-h-9", focus)}>
          {entry.symbol}{entry.session !== "UNKNOWN" ? <span className="text-xs font-normal text-muted-foreground">{locale === "ko" ? (entry.session === "AFTER" ? "미국 장후" : "미국 장전") : SESSION_LABEL[entry.session]}</span> : locale === "ko" && <span className="text-xs font-normal text-muted-foreground">{dateLabel(earningsDisplayDate(entry, locale).date)} ET · 시각 미제공</span>}
        </button>)}</div>
      </div>
    </div>
  );
}

function EventRow({ event, now, showState, showPrevious }: { event: EconEvent; now: number; showState: boolean; showPrevious: boolean }) {
  const { pick } = useLocale();
  const state = releaseState(event, now);
  return <li>
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <p className={cn("text-sm leading-5 text-foreground", event.tier === 1 ? "font-semibold" : "font-normal")}>{event.name}</p>
      {showState && <StateLabel state={state} important={event.tier === 1} />}
    </div>
    {event.kind === "print" && <>
      {(event.actual !== null || event.forecast !== null || event.previous !== null) && <p className="num mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs leading-5 text-muted-foreground">
        {event.actual !== null && <span>{pick("실제", "Actual")} <strong className="text-sm font-semibold text-foreground">{event.actual}</strong></span>}
        {event.forecast !== null ? <span>{pick("예상", "Est")} <span className="text-foreground">{event.forecast}</span></span> : event.actual !== null ? <span>{pick("예상치 없음", "No estimate")}</span> : event.previous !== null ? <span>{pick("이전", "Prev")} {event.previous}</span> : null}
      </p>}
      {showPrevious && event.previous !== null && (event.actual !== null || event.forecast !== null) && <p className="num mt-1 text-xs leading-5 text-muted-foreground">{pick("이전", "Prev")} {event.previous}</p>}
    </>}
  </li>;
}

function StateLabel({ state, important }: { state: ReleaseState; important: boolean }) {
  const { locale } = useLocale();
  const labels: Record<Locale, Record<ReleaseState, string>> = {
    en: { scheduled: "Scheduled", received: "Released", unconfirmed: "Release unconfirmed", elapsed: "Scheduled time passed", "all-day": "All-day event" },
    ko: { scheduled: "예정", received: "발표", unconfirmed: "발표 미확인", elapsed: "예정 시간 경과", "all-day": "종일 일정" },
  };
  return <span className={cn("text-xs leading-4", state === "scheduled" && important ? "font-medium text-primary" : state === "unconfirmed" ? "font-medium text-foreground" : "text-muted-foreground")}>{labels[locale][state]}</span>;
}
function EventClock({ event }: { event: EconEvent }) {
  const { locale } = useLocale();
  const primary = eventDisplayTime(event, locale);
  const secondary = eventDisplayTime(event, locale === "ko" ? "en" : "ko");
  return <><span className="whitespace-nowrap">{primary.time} {primary.zone}</span><span className="ml-2 whitespace-nowrap">{secondary.date !== primary.date && `${dateLabel(secondary.date)} `}{secondary.time} {secondary.zone}</span></>;
}
function FeedError({ name, at, sourceDate }: { name: string; at: string | null; sourceDate: string }) {
  const { locale, pick } = useLocale();
  return <p className="mb-2 text-xs leading-5 font-medium">{name} {pick("피드 사용 불가", "feed unavailable")}{locale === "ko" && ` · ${dateLabel(sourceDate)} ET`}{at && <span className="block font-normal text-muted-foreground">{pick("이전 데이터", "Previous data")} · {checkedLabel(at, locale)} {calendarZoneLabel(locale)}</span>}</p>;
}
function weekday(date: string, locale: Locale) { return new Date(`${date}T00:00:00Z`).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { weekday: "short", timeZone: "UTC" }); }
function dateLabel(date: string) { const [, month, day] = date.split("-"); return `${Number(month)}/${Number(day)}`; }
function checkedLabel(at: string, locale: Locale) { return new Date(at).toLocaleString(locale === "ko" ? "ko-KR" : "en-US", { timeZone: calendarZone(locale), month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); }
