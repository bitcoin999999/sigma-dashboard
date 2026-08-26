import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DataBasis } from "@/components/dashboard/data-basis";
import { SigmaRangeBar } from "@/components/dashboard/sigma-range-bar";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { NavBar } from "@/components/layout/nav-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { findStock, loadBoard } from "@/lib/board";
import {
  directionClass,
  formatBandWidth,
  formatCurrency,
  formatPercent,
  formatSigma,
} from "@/lib/format";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { STATUS_META, statusStyle } from "@/lib/sigma";
import type { StockData } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The snapshot file is rewritten out of band by the daily job, so never cache it. */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ symbol: string }> };

function describe(stock: StockData, updatedAt: string): string {
  return (
    `${stock.symbol} (${stock.name}) closed at ${formatCurrency(stock.price)} ` +
    `at the ${updatedAt}, ${formatSigma(stock.zScore)} from its weekly anchor. ` +
    `The 1σ expected move for the week runs ` +
    `${formatCurrency(stock.sigma1Lower)} to ${formatCurrency(stock.sigma1Upper)} ` +
    `(${formatBandWidth(stock.sigmaPercent)}).`
  );
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { symbol } = await params;
  const stock = await findStock(symbol);

  if (!stock) {
    return { title: `Symbol not found · ${SITE_NAME}` };
  }

  const { snapshot } = await loadBoard();
  const title = `${stock.symbol} Expected Move This Week · ${SITE_NAME}`;
  const description = describe(stock, snapshot.updatedAt);
  const url = `/symbol/${stock.symbol}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", url, title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SymbolPage({ params }: Params) {
  const { symbol } = await params;
  const stock = await findStock(symbol);

  if (!stock) notFound();

  const { snapshot } = await loadBoard();
  const meta = STATUS_META[stock.status];

  const stats: { term: string; detail: string; className?: string }[] = [
    { term: "Last close", detail: formatCurrency(stock.price) },
    {
      term: "Session change",
      detail: formatPercent(stock.changePercent),
      className: directionClass(stock.changePercent),
    },
    { term: "Position on band", detail: formatSigma(stock.zScore) },
    {
      // Not "1σ expected range": the label style uppercases, and an uppercased
      // sigma is a different symbol entirely.
      term: "Expected range",
      detail: `${formatCurrency(stock.sigma1Lower)} – ${formatCurrency(stock.sigma1Upper)}`,
    },
    { term: "Band width", detail: formatBandWidth(stock.sigmaPercent) },
    { term: "Anchor close", detail: formatCurrency(stock.anchor) },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${stock.symbol} weekly 1σ expected move`,
    description: describe(stock, snapshot.updatedAt),
    url: `${SITE_URL}/symbol/${stock.symbol}`,
    dateModified: snapshot.generatedAt,
    temporalCoverage: snapshot.bandWindow,
    isAccessibleForFree: true,
    creator: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    variableMeasured: [
      { "@type": "PropertyValue", name: "Last close", value: stock.price },
      { "@type": "PropertyValue", name: "Anchor close", value: stock.anchor },
      {
        "@type": "PropertyValue",
        name: "1σ implied move",
        value: stock.sigmaPercent,
        unitText: "PERCENT",
      },
      { "@type": "PropertyValue", name: "Z-score", value: stock.zScore },
      {
        "@type": "PropertyValue",
        name: "Upper 1σ edge",
        value: stock.sigma1Upper,
      },
      {
        "@type": "PropertyValue",
        name: "Lower 1σ edge",
        value: stock.sigma1Lower,
      },
    ],
  };

  return (
    <>
      <NavBar
        snapshot={snapshot}
        updatedAt={snapshot.updatedAt}
        sections={false}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-10 pb-4 sm:px-6 sm:pt-14 lg:px-8">
        <script
          type="application/ld+json"
          // Structured data has to be inlined as text for crawlers to read it.
          // The payload is built above from snapshot fields only, and the
          // escape keeps a stray "<" in a company name from closing the tag.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />

        <div style={statusStyle(stock.status)} className="max-w-3xl">
          <p className="label-xs">
            {stock.sector} · band window {snapshot.bandWindow}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="num font-heading text-[1.75rem] leading-none font-semibold tracking-[-0.03em] sm:text-4xl">
              {stock.symbol}
            </h1>
            <StatusBadge status={stock.status} />
          </div>

          <p className="mt-3 text-sm text-muted-foreground">{stock.name}</p>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {meta.description}
          </p>

          <div className="mt-7">
            <SigmaRangeBar zScore={stock.zScore} status={stock.status} />
          </div>

          <dl className="mt-7 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.term}>
                <dt className="label-xs">{stat.term}</dt>
                <dd
                  className={cn(
                    "num mt-1.5 text-[15px] font-semibold",
                    stat.className,
                  )}
                >
                  {stat.detail}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-wrap gap-2">
            <Link
              href={`/my-sigma?s=${stock.symbol}`}
              className="inline-flex h-9 items-center rounded-full border border-border/80 px-3.5 text-xs font-medium transition-colors hover:border-border hover:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Open in My Sigma
            </Link>
            <Link
              href="/"
              className="inline-flex h-9 items-center rounded-full border border-border/80 px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              See the whole board
            </Link>
          </div>
        </div>

        <DataBasis snapshot={snapshot} className="mt-10 max-w-4xl" />
      </main>

      <SiteFooter snapshot={snapshot} />
    </>
  );
}
