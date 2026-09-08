import { Dashboard } from "@/components/dashboard/dashboard";
import { JsonLd } from "@/components/seo/json-ld";
import { loadWeekCalendar } from "@/lib/econ-calendar";
import { loadSnapshot } from "@/lib/snapshot";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

/** The snapshot file is rewritten out of band by the daily job, so never cache it. */
export const dynamic = "force-dynamic";

export default async function Home() {
  const { quotes, sectorQuotes, snapshot } = await loadSnapshot();

  // Keyed off the band anchor so the week on the calendar is the week the board
  // is scoring, and filtered to names actually on the board. Resolves to null
  // when the vendor is unreachable — the board renders without it.
  const calendar = await loadWeekCalendar(
    snapshot.bandAnchorDate,
    quotes.map((quote) => quote.symbol),
  );

  // A Dataset rather than a WebPage: what the board publishes is a measured
  // series, and it is the type the per-symbol pages already declare. Saying the
  // same thing at both levels lets a crawler tie the symbol pages to their
  // source instead of reading them as unrelated documents.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${SITE_NAME} · ${SITE_TAGLINE}`,
    description: `Weekly 1σ implied ranges for ${quotes.length} symbols, scored against each name's own option-implied volatility.`,
    url: SITE_URL,
    dateModified: snapshot.generatedAt,
    temporalCoverage: snapshot.bandWindow,
    isAccessibleForFree: true,
    creator: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    keywords: [
      "implied volatility",
      "expected move",
      "weekly options range",
      "standard deviation",
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <Dashboard
        quotes={quotes}
        sectorQuotes={sectorQuotes}
        snapshot={snapshot}
        calendar={calendar}
      />
    </>
  );
}
