"use client";

import * as React from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";
import type { CalendarDay, EarningsEvent, EconEvent, WeekCalendar as CalendarData } from "@/lib/econ-calendar";
import { easternDate, keySchedule, releaseState, retainCalendar, SESSION_LABEL, type ReleaseState } from "@/lib/calendar-state";
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
      if (response.status === 409) throw new Error(pick("밴드 주간이 바뀌었습니다. 페이지를 새로고침하세요.", "The band week has changed. Reload the page."));
      if (!response.ok) throw new Error(pick("일정 새로고침 실패 · 이전 데이터를 표시합니다.", "Calendar refresh failed · showing previous data."));
      const next = await response.json() as CalendarData;
      setCalendar(old => retainCalendar(next, old));
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
  }, [bandAnchorDate, pick]);

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
    <aside id="week-calendar" aria-label={pick("이번 주 거시경제 및 실적 일정", "This week’s macro and earnings calendar")} className={cn("glass scroll-mt-28 p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold">{pick("이번 주", "This week")}</h2>
          <span className="num text-xs text-muted-foreground">{dateLabel(calendar.weekStart)} – {dateLabel(calendar.weekEnd)} · {pick("날짜는 ET 기준", "Dates in ET")}</span>
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
            <p className="num text-xs text-muted-foreground">{weekday(next.date, locale)} {dateLabel(next.date)} · {kstLabel(next, locale)}</p>
            <span className="text-xs text-primary">{pick("예정", "Scheduled")}{key.incomplete || error ? pick(" · 확인 가능한 데이터", " · available data") : ""}</span>
          </> : <p className="text-sm font-medium">{key.incomplete || error ? pick("주요 일정 데이터가 불완전합니다", "Key event coverage is incomplete") : key.allDay.length ? `${pick("시간 미지정", "Time unspecified")} · ${key.allDay.map(event => event.name).join(" / ")}` : pick("확인 가능한 데이터에 예정된 주요 일정이 없습니다", "No upcoming key events in available data")}</p>}
        </div>
        {key.unconfirmed.length > 0 && <p className="mt-2 text-xs font-medium">{pick("발표 미확인", "Release unconfirmed")} · {key.unconfirmed.map(event => event.name).join(" / ")}</p>}
        {key.allDay.length > 0 && next && <p className="mt-2 text-xs">{pick("종일 주요 일정", "All-day key events")} · {key.allDay.map(event => event.name).join(" / ")}</p>}
        {(partial || error) && <p className="mt-2 text-xs font-medium">{error ?? pick("일부 피드를 사용할 수 없습니다 · 일자별 데이터 상태를 확인하세요.", "Some feeds are unavailable · check each day’s data status.")}</p>}
      </div>

      <ol className="mt-4 grid grid-cols-1 gap-x-5 gap-y-3 min-[1180px]:grid-cols-5">
        {calendar.days.map(day => <DayColumn key={day.date} day={day} now={now} today={today} onSelect={onSelect} showPrevious={showPrevious} />)}
      </ol>
      <footer className="mt-4 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
        <p>{pick("선별된 macro · 하루 최대 5개 · 시간은 예정 기준", "Selected macro · up to 5 per day · times are scheduled")}</p>
        <p className="num">{oldest ? `${pick("데이터 기준", "Data as of")} ${checkedLabel(oldest, locale)} KST` : pick("수신된 데이터 없음", "No data received")} · {pick("자동 확인", "Auto-check")}</p>
      </footer>
    </aside>
  );
}

function DayColumn({ day, now, today, onSelect, showPrevious }: {
  day: CalendarDay; now: number; today: string; showPrevious: boolean; onSelect: WeekCalendarProps["onSelect"];
}) {
  const { locale, pick } = useLocale();
  const [expanded, setExpanded] = React.useState<boolean | null>(null);
  const uncertain = day.events.some(event => event.tier === 1 && releaseState(event, now) === "unconfirmed");
  const failed = day.macroStatus === "error" || day.earningsStatus === "error";
  const hasRows = day.events.length > 0 || day.earnings.length > 0 || failed;
  const open = expanded ?? (day.date >= today || uncertain || failed);
  const groups = new Map<string, EconEvent[]>();
  for (const event of day.events) groups.set(event.timeEt, [...(groups.get(event.timeEt) ?? []), event]);
  const received = day.events.filter(event => releaseState(event, now) === "received").length;
  const title = <><span className={cn("num text-sm font-semibold", day.date === today && "rounded bg-foreground px-1.5 py-0.5 text-background")}>{weekday(day.date, locale)} {dateLabel(day.date)}</span>{day.date === today && <span className="ml-auto text-xs font-medium">{pick("오늘", "Today")} · ET</span>}</>;
  return (
    <li className="min-w-0 border-b border-border pb-3 last:border-b-0 min-[1180px]:row-span-3 min-[1180px]:grid min-[1180px]:grid-rows-subgrid min-[1180px]:border-b-0 min-[1180px]:pb-0">
      <div>
        <div className="hidden min-h-9 items-center gap-2 border-b border-border pb-2 min-[1180px]:flex">{title}</div>
        <button type="button" aria-expanded={hasRows ? open : undefined} aria-controls={hasRows ? `day-${day.date} earnings-${day.date}` : undefined}
          disabled={!hasRows} onClick={() => setExpanded(!open)}
          className={cn("flex min-h-11 w-full items-center gap-2 text-left min-[1180px]:hidden", focus)}>
          {title}{hasRows && <ChevronDown aria-hidden className={cn("ml-auto size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />}
        </button>
        {!open && hasRows && <p className="pb-1 text-xs leading-5 text-muted-foreground min-[1180px]:hidden">{day.macroStatus === "error" ? pick("Macro 피드 사용 불가", "Macro feed unavailable") : received > 0 ? pick(`${received}개 발표`, `${received} released`) : `${day.events.length} macro`} · {day.earningsStatus === "error" ? pick("실적 피드 사용 불가", "Earnings feed unavailable") : pick(`실적 ${day.earnings.length}개`, `${day.earnings.length} earnings`)}{day.events.some(event => event.tier === 1) && ` · ${day.events.filter(event => event.tier === 1).map(event => event.name).join(" / ")}`}</p>}
      </div>
      <div id={`day-${day.date}`} className={cn(!open && hasRows ? "hidden" : "block", "min-[1180px]:block")}>
        {day.macroStatus === "error" && <FeedError name="Macro" at={day.macroCheckedAt} />}
        {day.events.length === 0 && day.macroStatus === "ok" && <p className="py-1 text-xs text-muted-foreground">{pick("예정된 일정 없음", "No scheduled events")}</p>}
        <div className="space-y-4">
          {[...groups].map(([time, events]) => {
            const states = [...new Set(events.map(event => releaseState(event, now)))];
            return <section key={time} aria-label={`${time || pick("종일", "All day")} Macro`}>
              <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="num text-xs leading-4 text-muted-foreground">{time ? <><span className="whitespace-nowrap">{kstLabel(events[0], locale)}</span><span className="ml-2 whitespace-nowrap">{time} ET</span></> : pick("종일", "All day")}</p>
                {states.length === 1 && <StateLabel state={states[0]} important={events.some(event => event.tier === 1)} />}
              </div>
              <ul className="space-y-3">{events.map(event => <EventRow key={event.name} event={event} now={now} showPrevious={showPrevious} showState={states.length > 1} />)}</ul>
            </section>;
          })}
        </div>
      </div>
      <div id={`earnings-${day.date}`} className={cn(!open ? "hidden" : "block", "min-[1180px]:block")}>
        {(day.earnings.length > 0 || day.earningsStatus === "error") && <div className="mt-3 border-t border-border pt-3 min-[1180px]:mt-0">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{pick("추적 종목 실적", "Tracked earnings")}</p>
          {day.earningsStatus === "error" && <FeedError name={pick("실적", "Earnings")} at={day.earningsCheckedAt} />}
          <div className="flex flex-wrap gap-2">{day.earnings.map(entry => <button key={entry.symbol} type="button"
            onClick={() => onSelect(entry.symbol, entry)} aria-label={`${entry.symbol} ${SESSION_LABEL[entry.session]} ${pick("실적 상세", "earnings details")}`}
            className={cn("num inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-2.5 text-sm font-semibold hover:bg-muted min-[1180px]:min-h-9", focus)}>
            {entry.symbol}{entry.session !== "UNKNOWN" && <span className="text-xs font-normal text-muted-foreground">{SESSION_LABEL[entry.session]}</span>}
          </button>)}</div>
        </div>}
      </div>
    </li>
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
function FeedError({ name, at }: { name: string; at: string | null }) {
  const { locale, pick } = useLocale();
  return <p className="mb-2 text-xs leading-5 font-medium">{name} {pick("피드 사용 불가", "feed unavailable")}{at && <span className="block font-normal text-muted-foreground">{pick("이전 데이터", "Previous data")} · {checkedLabel(at, locale)} KST</span>}</p>;
}
function weekday(date: string, locale: Locale) { return new Date(`${date}T00:00:00Z`).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { weekday: "short", timeZone: "UTC" }); }
function dateLabel(date: string) { const [, month, day] = date.split("-"); return `${Number(month)}/${Number(day)}`; }
function kstLabel(event: EconEvent, locale: Locale) { return `${event.kstNextDay ? (locale === "ko" ? "익일 " : "Next day ") : ""}${event.timeKst} KST`; }
function checkedLabel(at: string, locale: Locale) { return new Date(at).toLocaleString(locale === "ko" ? "ko-KR" : "en-US", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); }
