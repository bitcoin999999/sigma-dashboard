import type { Metadata } from "next";

import { GuideArticle } from "@/components/guide/guide-article";
import { NavBar } from "@/components/layout/nav-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { JsonLd } from "@/components/seo/json-ld";
import { loadBoard } from "@/lib/board";
import { GUIDE_COPY } from "@/lib/guide-copy";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/** The snapshot file is rewritten out of band by the daily job, so never cache it. */
export const dynamic = "force-dynamic";

const TITLE = "How to Read 1SIGMA — The Weekly Implied Range, Explained";
const DESCRIPTION =
  "What a σ reading measures, how the weekly band is struck from Friday's close and the options market's implied move, and how to use it alongside dealer gamma — with a worked example.";

export const metadata: Metadata = {
  title: `${TITLE} · ${SITE_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: "/guide" },
  openGraph: {
    type: "article",
    url: "/guide",
    title: `${TITLE} · ${SITE_NAME}`,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} · ${SITE_NAME}`,
    description: DESCRIPTION,
  },
};

export default async function GuidePage() {
  const { snapshot, all } = await loadBoard();

  // Structured data stays English: the page is one URL and the translation is
  // a client-side preference, so the markup a crawler indexes has to match the
  // language it is served in.
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}/guide`,
      isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
      author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
      about: [
        "implied volatility",
        "expected move",
        "standard deviation",
        "gamma exposure",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: GUIDE_COPY.en.faq.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <NavBar
        snapshot={snapshot}
        updatedAt={snapshot.updatedAt}
        sections={false}
      />

      <GuideArticle
        bandAnchorDate={snapshot.bandAnchorDate}
        symbolCount={all.length}
      />

      <SiteFooter snapshot={snapshot} />
    </>
  );
}
