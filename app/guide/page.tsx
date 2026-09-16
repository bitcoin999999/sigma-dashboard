import { tickerDirectory } from "@/lib/ticker-search";
import type { Metadata } from "next";

import { GuideArticle } from "@/components/guide/guide-article";
import { NavBar } from "@/components/layout/nav-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { JsonLd } from "@/components/seo/json-ld";
import { loadBoard } from "@/lib/board";
import { GUIDE_COPY } from "@/lib/guide-copy";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { getRequestLocale } from "@/lib/i18n-server";

/** The snapshot file is rewritten out of band by the daily job, so never cache it. */
export const dynamic = "force-dynamic";

const TITLE = "How to Read 1SIGMA — The Weekly Implied Range, Explained";
const DESCRIPTION =
  "What a σ reading measures, how the weekly band is struck from Friday's close and the options market's implied move, and how to use it alongside dealer gamma — with a worked example.";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const title = `${locale === "ko" ? GUIDE_COPY.ko.title : TITLE} · ${SITE_NAME}`;
  const description = locale === "ko" ? GUIDE_COPY.ko.intro : DESCRIPTION;
  return {
  title,
  description,
  alternates: { canonical: "/guide" },
  openGraph: {
    type: "article",
    url: "/guide",
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

export default async function GuidePage() {
  const { snapshot, all } = await loadBoard();
  const locale = await getRequestLocale();
  const guide = GUIDE_COPY[locale];

  // Structured data stays English: the page is one URL and the translation is
  // a client-side preference, so the markup a crawler indexes has to match the
  // language it is served in.
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: locale === "ko" ? guide.title : TITLE,
      description: locale === "ko" ? guide.intro : DESCRIPTION,
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
      mainEntity: guide.faq.items.map((item) => ({
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
        tickers={tickerDirectory(all)}
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
