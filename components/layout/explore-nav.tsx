import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { SCREENERS } from "@/lib/screeners";
import { cn } from "@/lib/utils";

/**
 * The screener and daily-card routes, as something you can click.
 *
 * Every one of these pages is reachable by typing its URL, which is no way to
 * find a page. This row is the entry point, and it goes on the board as well as
 * on the pages themselves so the set is always one hop away.
 */
interface ExploreNavProps {
  /**
   * The one session the app holds. The daily card refuses any other date, so
   * the link has to be built from the snapshot rather than from today's clock.
   */
  sessionDate: string;
  /** Screener slug, or `"daily"`, when this row is rendered on one of them. */
  current?: string;
  className?: string;
}

function pillClass(current: boolean): string {
  return cn(
    "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs font-medium transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    current
      ? "border-border bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)] text-foreground"
      : "border-border/80 text-muted-foreground hover:border-border hover:text-foreground",
  );
}

export function ExploreNav({
  sessionDate,
  current,
  className,
}: ExploreNavProps) {
  return (
    <nav
      aria-label="Lists"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {SCREENERS.map((screener) => (
        <Link
          key={screener.slug}
          href={`/screener/${screener.slug}`}
          aria-current={screener.slug === current ? "page" : undefined}
          className={pillClass(screener.slug === current)}
        >
          {screener.title}
        </Link>
      ))}

      <Link
        href={`/daily/${sessionDate}`}
        aria-current={current === "daily" ? "page" : undefined}
        className={pillClass(current === "daily")}
      >
        <CalendarDays className="size-3.5" aria-hidden />
        Today&rsquo;s card
      </Link>
    </nav>
  );
}
