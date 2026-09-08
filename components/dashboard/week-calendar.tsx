"use client";

import type {
  CalendarDay,
  EarningsEvent,
  EconEvent,
  WeekCalendar as WeekCalendarData,
} from "@/lib/econ-calendar";
import { cn } from "@/lib/utils";

interface WeekCalendarProps {
  calendar: WeekCalendarData;
  /** Opens the detail panel for a name reporting this week. */
  onSelect: (symbol: string) => void;
  className?: string;
}

const SESSION_LABEL: Record<EarningsEvent["session"], string> = {
  PRE: "Pre",
  AFTER: "After",
  UNKNOWN: "—",
};

/**
 * What is scheduled to move the tape this week, next to which tracked names
 * report.
 *
 * Sits beside the band copy because it answers the question the band raises but
 * cannot answer: a symbol pinned at its anchor on Wednesday means one thing
 * with CPI behind it and another with CPI still to come. Every clock reading is
 * given twice — the exchange runs on New York, the reader does not.
 */
export function WeekCalendar({
  calendar,
  onSelect,
  className,
}: WeekCalendarProps) {
  return (
    <aside className={cn("glass p-4 sm:p-5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="label-xs">Week ahead</p>
          <h2 className="mt-1 font-heading text-sm font-medium">
            Macro prints &amp; earnings
          </h2>
        </div>
        <p className="num shrink-0 text-right text-[10px] leading-4 text-muted-foreground/70">
          {formatRange(calendar.weekStart, calendar.weekEnd)}
          <br />
          ET / KST
        </p>
      </div>

      <ol className="mt-4 space-y-1">
        {calendar.days.map((day) => (
          <DayRow
            key={day.date}
            day={day}
            today={day.date === calendar.todayEt}
            onSelect={onSelect}
          />
        ))}
      </ol>

      <p className="mt-3 border-t border-border/50 pt-2.5 text-[10px] leading-relaxed text-muted-foreground/60">
        Consensus and actual as published by the calendar vendor. Times are
        scheduled release times, not confirmations.
      </p>
    </aside>
  );
}

function DayRow({
  day,
  today,
  onSelect,
}: {
  day: CalendarDay;
  today: boolean;
  onSelect: (symbol: string) => void;
}) {
  const empty = day.events.length === 0 && day.earnings.length === 0;

  return (
    <li
      className={cn(
        "rounded-lg px-2 py-2",
        // The marker is a tint rather than a border so the row keeps its
        // baseline alignment with the four days around it.
        today && "bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)]",
      )}
    >
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "num w-8 shrink-0 text-[11px] font-semibold",
            today ? "text-foreground" : "text-foreground/75",
          )}
        >
          {weekdayOf(day.date)}
        </span>
        <span className="num text-[11px] text-muted-foreground/70">
          {monthDayOf(day.date)}
        </span>
        {today && (
          <span className="label-xs text-[9px] tracking-[0.12em] text-foreground/60">
            Today
          </span>
        )}
        {empty && (
          <span className="ml-auto text-[10px] text-muted-foreground/50">
            No scheduled prints
          </span>
        )}
      </div>

      {day.events.length > 0 && (
        <ul className="mt-1.5 space-y-1.5">
          {day.events.map((event) => (
            <EventRow key={`${event.name}-${event.timeEt}`} event={event} />
          ))}
        </ul>
      )}

      {day.earnings.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="label-xs text-[9px] tracking-[0.12em]">Earnings</span>
          {day.earnings.map((entry) => (
            <button
              key={entry.symbol}
              type="button"
              onClick={() => onSelect(entry.symbol)}
              title={
                entry.epsForecast
                  ? `${entry.name} · consensus EPS ${entry.epsForecast}`
                  : entry.name
              }
              className="num rounded-md border border-border/70 px-1.5 py-0.5 text-[10px] font-semibold transition-colors hover:border-border hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {entry.symbol}
              <span className="ml-1 font-normal text-muted-foreground/70">
                {SESSION_LABEL[entry.session]}
              </span>
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

function EventRow({ event }: { event: EconEvent }) {
  return (
    <li className="flex gap-2.5">
      <div className="w-10 shrink-0 pt-px">
        <p className="num text-[11px] leading-tight text-foreground/85">
          {event.timeEt || "—"}
        </p>
        {event.timeKst && (
          <p className="num text-[10px] leading-tight text-muted-foreground/60">
            {event.timeKst}
            {event.kstNextDay && <span className="ml-0.5">+1</span>}
          </p>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-[11.5px] leading-tight",
            event.tier === 1
              ? "font-medium text-foreground"
              : "text-muted-foreground",
          )}
          title={event.name}
        >
          {event.name}
        </p>
        <p className="num mt-0.5 flex flex-wrap gap-x-2.5 text-[10px] leading-tight">
          <Figure label="Act" value={event.actual} strong />
          <Figure label="Est" value={event.forecast} />
          <Figure label="Prev" value={event.previous} />
        </p>
      </div>
    </li>
  );
}

/**
 * One of the three readings.
 *
 * An unreleased actual renders as an em dash rather than being hidden: the gap
 * is the information — it says the print is still ahead of the week, which is
 * the whole reason to look at the row before Thursday.
 */
function Figure({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string | null;
  strong?: boolean;
}) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-muted-foreground/50">{label} </span>
      <span
        className={cn(
          value === null
            ? "text-muted-foreground/40"
            : strong
              ? "font-semibold text-foreground"
              : "text-muted-foreground/85",
        )}
      >
        {value ?? "—"}
      </span>
    </span>
  );
}

/**
 * Calendar-date helpers pinned to UTC.
 *
 * These strings are labels for a US trading day, not instants. Parsing them in
 * the reader's zone would slide every heading a day backwards for anyone west
 * of Greenwich, and would make the server and client markup disagree.
 */
function weekdayOf(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

function monthDayOf(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatRange(start: string, end: string): string {
  return `${monthDayOf(start)} – ${monthDayOf(end)}`;
}
