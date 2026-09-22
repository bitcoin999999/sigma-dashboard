import Link from "next/link";
import { loadBoard } from "@/lib/board";
import { tickerDirectory } from "@/lib/ticker-search";
import { NavBar } from "@/components/layout/nav-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { PortfolioDashboard } from "@/components/portfolio/portfolio-dashboard";
import { getRequestLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/i18n";
export const dynamic = "force-dynamic";
export const metadata = { title: "My Sigma · Portfolio | 1SIGMA", robots: { index:false,follow:true }, alternates: { canonical:"/my-sigma/portfolio" } };
export default async function PortfolioPage() {
  const {all,snapshot}=await loadBoard(); const locale=await getRequestLocale();
  return <><NavBar tickers={tickerDirectory(all)} snapshot={snapshot} updatedAt={snapshot.updatedAt} sections={false}/><main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h1 className="font-heading text-2xl font-semibold tracking-tight">My Sigma <span className="text-muted-foreground">/ {pick(locale,"포트폴리오","Portfolio")}</span></h1><Link href="/my-sigma" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">{pick(locale,"관심목록","Watchlist")}</Link></div><PortfolioDashboard stocks={all} snapshot={snapshot}/></main><SiteFooter snapshot={snapshot}/></>;
}
