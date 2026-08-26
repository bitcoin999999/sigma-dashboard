import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DataBasis } from "@/components/dashboard/data-basis";
import { ScreenerResults } from "@/components/dashboard/screener-results";
import { ExploreNav } from "@/components/layout/explore-nav";
import { NavBar } from "@/components/layout/nav-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { loadBoard } from "@/lib/board";
import { findScreener } from "@/lib/screeners";
import { SITE_NAME } from "@/lib/site";

/** The snapshot file is rewritten out of band by the daily job, so never cache it. */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const screener = findScreener(slug);

  if (!screener) {
    return { title: `Screener not found · ${SITE_NAME}` };
  }

  const title = `${screener.metaTitle} · ${SITE_NAME}`;
  const url = `/screener/${screener.slug}`;

  return {
    title,
    description: screener.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description: screener.metaDescription,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: screener.metaDescription,
    },
  };
}

export default async function ScreenerPage({ params }: Params) {
  const { slug } = await params;
  const screener = findScreener(slug);

  if (!screener) notFound();

  const { snapshot, all } = await loadBoard();
  const hits = screener.select(all);

  return (
    <>
      <NavBar
        snapshot={snapshot}
        updatedAt={snapshot.updatedAt}
        sections={false}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-10 pb-4 sm:px-6 sm:pt-14 lg:px-8">
        <div className="max-w-2xl">
          <p className="label-xs">
            Screener · band window {snapshot.bandWindow}
          </p>
          <h1 className="mt-3 font-heading text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
            <span className="text-gradient">{screener.title}</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {screener.blurb}
          </p>
        </div>

        <ExploreNav
          sessionDate={snapshot.sessionDate}
          current={screener.slug}
          className="mt-7"
        />

        <DataBasis snapshot={snapshot} className="mt-7 max-w-4xl" />

        <div className="mt-10">
          {hits.length === 0 ? (
            <>
              {/* No layout toggle on an empty list: there is nothing to lay
                  out, and a control that changes nothing invites a click that
                  looks broken. */}
              <div className="mb-5 flex items-end justify-between gap-4">
                <h2 className="font-heading text-xl font-semibold tracking-[-0.02em]">
                  Results
                </h2>
                <span className="num text-xs text-muted-foreground">
                  0 of {all.length} symbols
                </span>
              </div>
              <div className="glass flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <p className="text-sm font-medium">{screener.empty}</p>
                <p className="text-xs text-muted-foreground">
                  Measured at the {snapshot.updatedAt}.
                </p>
              </div>
            </>
          ) : (
            <ScreenerResults stocks={hits} total={all.length} />
          )}
        </div>
      </main>

      <SiteFooter snapshot={snapshot} />
    </>
  );
}
