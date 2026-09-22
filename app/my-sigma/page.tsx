import { WATCHLIST_LIMIT } from "@/lib/watchlist";
import type { Metadata } from "next";

import { MySigmaClient } from "@/components/my-sigma/my-sigma-client";
import { loadBoard } from "@/lib/board";
import { SITE_NAME } from "@/lib/site";
import { getRequestLocale } from "@/lib/i18n-server";

/** The snapshot file is rewritten out of band by the daily job, so never cache it. */
export const dynamic = "force-dynamic";

const DESCRIPTION =
  `Track up to ${WATCHLIST_LIMIT} symbols and manage your portfolio on this browser.`;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const title = `My Sigma · ${locale === "ko" ? "개인 워치리스트" : "Personal Watchlist"} · ${SITE_NAME}`;
  const description = locale === "ko" ? `최대 ${WATCHLIST_LIMIT}개 관심종목의 주간 σ와 포트폴리오를 이 브라우저에서 관리하세요.` : DESCRIPTION;
  return {
  title,
  description,
  alternates: { canonical: "/my-sigma" },
  openGraph: {
    type: "website",
    url: "/my-sigma",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  };
}

export default async function MySigmaPage({ searchParams }: { searchParams: Promise<{ s?: string | string[] }> }) {
  const query = await searchParams;
  const sharedSymbols = typeof query.s === "string" ? query.s : "";
  const { snapshot, all } = await loadBoard();

  return <MySigmaClient key={sharedSymbols} stocks={all} snapshot={snapshot} sharedSymbols={sharedSymbols} />;
}
