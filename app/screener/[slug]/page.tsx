import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DataBasis } from "@/components/dashboard/data-basis";
import { StockCard } from "@/components/dashboard/stock-card";
import { GRID } from "@/components/dashboard/stock-grid";
import { NavBar } from "@/components/layout/nav-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { loadBoard } from "@/lib/board";
import { SCREENERS, findScreener } from "@/lib/screeners";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

/** The snapshot file is rewritten out of band by the daily job, so never cache it. */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const screener = findScreener(slug);

  if (!screener) {
    return { title: `Screener not found · ${SITE_NAME}` };
  }

  const title = `${screener.metaTitle} · ${SITE_NAME}`;
  const url = `/screener/${screener.slug}`;

  return {
    title,
    description: screener.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description: screener.metaDescription,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: screener.metaDescription,
    },
  };
}

export default async function ScreenerPage({ params }: Params) {
  const { slug } = await params;
  const screener = findScreener(slug);

  if (!screener) notFound();

  const { snapshot, all } = await loadBoard();
  const hits = screener.select(all);

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
            Screener · band window {snapshot.bandWindow}
          </p>
          <h1 className="mt-3 font-heading text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
            <span className="text-gradient">{screener.title}</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {screener.blurb}
          </p>
        </div>

        <nav
          aria-label="Screeners"
          className="mt-7 flex flex-wrap items-center gap-2"
        >
          {SCREENERS.map((entry) => (
            <Link
              key={entry.slug}
              href={`/screener/${entry.slug}`}
              aria-current={entry.slug === screener.slug ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-full border px-3.5 text-xs font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                entry.slug === screener.slug
                  ? "border-border bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)] text-foreground"
                  : "border-border/80 text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {entry.title}
            </Link>
          ))}
        </nav>

        <DataBasis snapshot={snapshot} className="mt-7 max-w-4xl" />

        <div className="mt-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="font-heading text-xl font-semibold tracking-[-0.02em]">
              Results
            </h2>
            <span className="num text-xs text-muted-foreground">
              {hits.length} of {all.length} symbols
            </span>
          </div>

          {hits.length === 0 ? (
            <div className="glass flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <p className="text-sm font-medium">{screener.empty}</p>
              <p className="text-xs text-muted-foreground">
                Measured at the {snapshot.updatedAt}.
              </p>
            </div>
          ) : (
            <div className={GRID}>
              {hits.map((stock) => (
                // The card renders as the link itself rather than being wrapped
                // in one, so there is exactly one interactive element per card.
                <StockCard
                  key={stock.symbol}
                  stock={stock}
                  href={`/symbol/${stock.symbol}`}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <SiteFooter snapshot={snapshot} />
    </>
  );
}
