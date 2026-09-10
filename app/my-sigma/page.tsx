import type { Metadata } from "next";

import { MySigmaClient } from "@/components/my-sigma/my-sigma-client";
import { loadBoard } from "@/lib/board";
import { SITE_NAME } from "@/lib/site";
import { getRequestLocale } from "@/lib/i18n-server";

/** The snapshot file is rewritten out of band by the daily job, so never cache it. */
export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Pick up to ten symbols and watch them on the same weekly σ band as the main board. Stored in your browser, no account needed, shareable as a link.";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const title = `My Sigma · ${locale === "ko" ? "개인 워치리스트" : "Personal Watchlist"} · ${SITE_NAME}`;
  const description = locale === "ko" ? "최대 10개 종목을 메인 보드와 같은 주간 σ 밴드에서 확인하세요. 계정 없이 브라우저에 저장하고 링크로 공유할 수 있습니다." : DESCRIPTION;
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

export default async function MySigmaPage() {
  const { snapshot, all } = await loadBoard();

  return <MySigmaClient stocks={all} snapshot={snapshot} />;
}
