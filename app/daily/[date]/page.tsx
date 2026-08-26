import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";

import { DataBasis } from "@/components/dashboard/data-basis";
import { StockCard } from "@/components/dashboard/stock-card";
import { GRID } from "@/components/dashboard/stock-grid";
import { NavBar } from "@/components/layout/nav-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { loadBoard } from "@/lib/board";
import { buildDailyDigest, isCalendarDate } from "@/lib/daily";
import { formatDay, formatEastern } from "@/lib/format";
import { SITE_NAME } from "@/lib/site";

/** The snapshot file is rewritten out of band by the daily job, so never cache it. */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ date: string }> };

/**
 * There is no archive behind this route.
 *
 * The publisher overwrites a single blob, so the app only ever holds one
 * session. A URL naming any other date is answered with a 404 rather than the
 * current board wearing that date's label — an old link that silently renders
 * today's numbers is the one failure mode worth refusing outright.
 */
async function resolveDaily(date: string) {
  if (!isCalendarDate(date)) return null;

  const board = await loadBoard();
  if (board.snapshot.sessionDate !== date) return null;

  return {
    ...board,
    digest: buildDailyDigest(board.all, board.snapshot.bandElapsed),
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { date } = await params;
  const daily = await resolveDaily(date);

  if (!daily) {
    return { title: `No board for that date · ${SITE_NAME}` };
  }

  const title = `${daily.digest.heading} · ${formatDay(date)} · ${SITE_NAME}`;
  const description = `${daily.digest.subheading}, measured at the ${daily.snapshot.updatedAt}: ${daily.digest.stocks
    .map((stock) => stock.symbol)
    .join(", ")}.`;
  const url = `/daily/${date}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    // The image itself comes from the sibling `opengraph-image.tsx`; Next
    // fills in og:image and twitter:image from that file convention.
    openGraph: { type: "article", url, title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function DailyPage({ params }: Params) {
  const { date } = await params;
  const daily = await resolveDaily(date);

  if (!daily) notFound();

  const { snapshot, digest } = daily;

  return (
    <>
      <NavBar
        snapshot={snapshot}
        updatedAt={snapshot.updatedAt}
        sections={false}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-10 pb-4 sm:px-6 sm:pt-14 lg:px-8">
        <div className="max-w-2xl">
          <p className="label-xs">
            Daily card · {formatDay(date)} regular-session close
          </p>
          <h1 className="mt-3 font-heading text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
            <span className="text-gradient">{digest.heading}</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {digest.subheading}. Published {formatEastern(snapshot.generatedAt)}
            .
          </p>
        </div>

        <div className="mt-7 flex flex-wrap gap-2">
          <a
            href={`/daily/${date}/opengraph-image`}
            download={`1sigma-${date}.png`}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-border/80 px-3.5 text-xs font-medium transition-colors hover:border-border hover:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Download className="size-3.5" aria-hidden />
            Download share card
          </a>
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-full border border-border/80 px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            See the whole board
          </Link>
        </div>

        <DataBasis snapshot={snapshot} className="mt-7 max-w-4xl" />

        <div className={`${GRID} mt-10`}>
          {digest.stocks.map((stock) => (
            <StockCard
              key={stock.symbol}
              stock={stock}
              href={`/symbol/${stock.symbol}`}
            />
          ))}
        </div>
      </main>

      <SiteFooter snapshot={snapshot} />
    </>
  );
}
