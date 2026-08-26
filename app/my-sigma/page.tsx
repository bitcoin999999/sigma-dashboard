import type { Metadata } from "next";

import { MySigmaClient } from "@/components/my-sigma/my-sigma-client";
import { loadBoard } from "@/lib/board";
import { SITE_NAME } from "@/lib/site";

/** The snapshot file is rewritten out of band by the daily job, so never cache it. */
export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Pick up to ten symbols and watch them on the same weekly σ band as the main board. Stored in your browser, no account needed, shareable as a link.";

export const metadata: Metadata = {
  title: `My Sigma · Personal Watchlist · ${SITE_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: "/my-sigma" },
  openGraph: {
    type: "website",
    url: "/my-sigma",
    title: `My Sigma · Personal Watchlist · ${SITE_NAME}`,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `My Sigma · Personal Watchlist · ${SITE_NAME}`,
    description: DESCRIPTION,
  },
};

export default async function MySigmaPage() {
  const { snapshot, all } = await loadBoard();

  return <MySigmaClient stocks={all} snapshot={snapshot} />;
}
