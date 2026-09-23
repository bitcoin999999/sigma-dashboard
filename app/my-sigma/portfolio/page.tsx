import type { Metadata } from "next";

import { loadBoard } from "@/lib/board";
import { tickerDirectory } from "@/lib/ticker-search";
import { NavBar } from "@/components/layout/nav-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { MySigmaTabs } from "@/components/my-sigma/my-sigma-tabs";
import { PortfolioDashboard } from "@/components/portfolio/portfolio-dashboard";
import { getRequestLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/i18n";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: `My Sigma · ${pick(locale, "포트폴리오", "Portfolio")} · ${SITE_NAME}`,
    // Personal and empty for a crawler: the holdings only exist in the visitor's browser.
    robots: { index: false, follow: true },
    alternates: { canonical: "/my-sigma/portfolio" },
  };
}

export default async function PortfolioPage() {
  const { all, snapshot } = await loadBoard();
  const locale = await getRequestLocale();
  return (
    <>
      <NavBar tickers={tickerDirectory(all)} snapshot={snapshot} updatedAt={snapshot.updatedAt} sections={false} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-10 pb-8 sm:px-6 sm:pt-14">
        <p className="label-xs">{pick(locale, "내 포트폴리오 · 이 브라우저에만 저장", "My portfolio · this browser only")}</p>
        <h1 className="mt-3 font-heading text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-4xl">
          <span className="text-gradient">My Sigma</span>
        </h1>
        <MySigmaTabs current="portfolio" className="mt-5" />
        <div className="mt-6">
          <PortfolioDashboard stocks={all} snapshot={snapshot} />
        </div>
      </main>
      <SiteFooter snapshot={snapshot} />
    </>
  );
}
