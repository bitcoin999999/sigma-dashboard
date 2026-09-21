import { WatchButton } from "@/components/watchlist/watch-button";
import { CLASSIFICATION_LABELS } from "@/lib/classification";
import { SymbolShare } from "@/components/share/symbol-share";
import { tickerDirectory } from "@/lib/ticker-search";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DataBasis } from "@/components/dashboard/data-basis";
import { GexPanel } from "@/components/dashboard/gex-panel";
import { SigmaRangeBar } from "@/components/dashboard/sigma-range-bar";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { WeeklyPriceChart } from "@/components/dashboard/weekly-price-chart";
import { ExploreNav } from "@/components/layout/explore-nav";
import { NavBar } from "@/components/layout/nav-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { JsonLd } from "@/components/seo/json-ld";
import { findStock, loadBoard } from "@/lib/board";
import {
  directionClass,
  formatBandWidth,
  formatCurrency,
  formatPercent,
  formatSigma,
} from "@/lib/format";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { STATUS_COPY, pick, type Locale } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";
import { statusStyle } from "@/lib/sigma";
import { buildChartBands } from "@/lib/weekly-chart-bands";
import { buildGexChartSnapshot } from "@/lib/gex-chart-levels";
import { chartWeek } from "@/lib/weekly-chart";
import type { StockData } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The snapshot file is rewritten out of band by the daily job, so never cache it. */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ symbol: string }> };

function describe(stock: StockData, updatedAt: string, locale: Locale): string {
  if (locale === "ko") {
    return `${stock.symbol} (${stock.name})은 ${updatedAt} 기준 ${formatCurrency(stock.price)}에 마감했고, 주간 앵커에서 ${formatSigma(stock.zScore)} 위치입니다. 이번 주 1σ expected move는 ${formatCurrency(stock.sigma1Lower)}~${formatCurrency(stock.sigma1Upper)} (${formatBandWidth(stock.sigmaPercent)})입니다.`;
  }
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
  const locale = await getRequestLocale();

  if (!stock) {
    return { title: `${pick(locale, "종목을 찾을 수 없습니다", "Symbol not found")} · ${SITE_NAME}` };
  }

  const { snapshot } = await loadBoard();
  const title = `${stock.symbol} ${pick(locale, "이번 주 Expected Move", "Expected Move This Week")} · ${SITE_NAME}`;
  const description = describe(stock, snapshot.updatedAt, locale);
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

  const locale = await getRequestLocale();
  const { snapshot, all } = await loadBoard();
  const meta = STATUS_COPY[locale][stock.status];
  const chartBands = buildChartBands(stock, snapshot.bandAnchorDate);
  const chartGex = buildGexChartSnapshot(stock, chartWeek().weekStart, chartBands[0]?.weekStart ?? "");

  const stats: { term: string; detail: string; className?: string }[] = [
    { term: pick(locale, "최종 마감", "Last close"), detail: formatCurrency(stock.price) },
    {
      term: pick(locale, "세션 등락", "Session change"),
      detail: formatPercent(stock.changePercent),
      className: directionClass(stock.changePercent),
    },
    { term: pick(locale, "밴드 위치", "Position on band"), detail: formatSigma(stock.zScore) },
    {
      // Not "1σ expected range": the label style uppercases, and an uppercased
      // sigma is a different symbol entirely.
      term: pick(locale, "Expected range", "Expected range"),
      detail: `${formatCurrency(stock.sigma1Lower)} – ${formatCurrency(stock.sigma1Upper)}`,
    },
    { term: pick(locale, "밴드 너비", "Band width"), detail: formatBandWidth(stock.sigmaPercent) },
    { term: pick(locale, "앵커 마감", "Anchor close"), detail: formatCurrency(stock.anchor) },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${stock.symbol} weekly 1σ expected move`,
    description: describe(stock, snapshot.updatedAt, locale),
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
        tickers={tickerDirectory(all)}
        snapshot={snapshot}
        updatedAt={snapshot.updatedAt}
        sections={false}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-10 pb-4 sm:px-6 sm:pt-14 lg:px-8">
        <JsonLd data={jsonLd} />

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:gap-12">
        <div style={statusStyle(stock.status)} className="min-w-0">
          <p className="label-xs">
            {stock.sector} · {pick(locale, "밴드 기간", "band window")} {snapshot.bandWindow}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="num font-heading text-[1.75rem] leading-none font-semibold tracking-[-0.03em] sm:text-4xl">
              {stock.symbol}
            </h1>
            <StatusBadge status={stock.status} />
          </div>

          <p className="mt-3 text-sm text-muted-foreground">{stock.name}</p>

          {(stock.assetClass || stock.region || stock.themes?.length) && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {[stock.assetClass, stock.region].flatMap(value => value
              ? [CLASSIFICATION_LABELS[value] ? pick(locale, ...CLASSIFICATION_LABELS[value]) : value] : [])
              .concat(stock.themes ?? []).join(" · ")}
          </p>}

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

          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">{pick(locale, "표시 가격", "Price basis")}: {snapshot.sessionDate} {pick(locale, "미국 정규장 종가 · 차트 봉과 GEX OI 기준 시각은 차트에 별도 표시합니다.", "US regular-session close · candle and GEX OI timestamps are shown separately on the chart.")}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <WatchButton symbol={stock.symbol} />
          </div>
          <div className="mt-3"><SymbolShare symbol={stock.symbol} /></div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/my-sigma"
              className="inline-flex min-h-11 items-center rounded-full border border-border/80 px-3.5 text-xs font-medium transition-colors hover:border-border hover:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {pick(locale, "관심 목록 보기", "View watchlist")}
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-full border border-border/80 px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {pick(locale, "전체 보드 보기", "See the whole board")}
            </Link>
          </div>
        </div>

        <WeeklyPriceChart key={stock.symbol} symbol={stock.symbol} bands={chartBands} gex={chartGex} />
        </div>

        {/* On desktop this ladder was reachable only through the board's detail
            panel, behind a tab. A phone never opens that panel — tapping a card
            lands here — so the one view that says where the options market's
            weight is sitting had no route on mobile at all. Here it gets the
            page version: bigger rows, the net GEX figure per strike, and the σ
            band edges drawn across it. */}
        {stock.gex && (
          <section className="glass mt-10 max-w-3xl p-5 sm:p-6">
            <h2 className="font-heading text-base font-semibold tracking-tight">
              <span className="num">{stock.symbol}</span>{" "}
              {pick(locale, "행사가별 GEX 분포", "GEX by strike")}
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {pick(
                locale,
                "행사가마다 쌓인 딜러 감마입니다. 점선은 이번 주 ±1σ 밴드 가장자리이므로, 감마가 두꺼운 자리와 밴드 끝이 겹치는지 한 화면에서 확인할 수 있습니다.",
                "Dealer gamma stacked at each strike. The dashed lines are this week's ±1σ edges, so whether a thick strike and a band edge land on the same price is readable in one view.",
              )}
            </p>
            <div className="mt-5">
              <GexPanel stock={stock} detailed />
            </div>
          </section>
        )}

        <ExploreNav sessionDate={snapshot.sessionDate} className="mt-10" />

        <DataBasis snapshot={snapshot} className="mt-7 max-w-4xl" />
      </main>

      <SiteFooter snapshot={snapshot} />
    </>
  );
}
