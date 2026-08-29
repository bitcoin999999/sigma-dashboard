import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BandDiagram } from "@/components/guide/band-diagram";
import { CaseChart } from "@/components/guide/case-chart";
import { NavBar } from "@/components/layout/nav-bar";
import { Section } from "@/components/layout/section";
import { SiteFooter } from "@/components/layout/site-footer";
import { JsonLd } from "@/components/seo/json-ld";
import { loadBoard } from "@/lib/board";
import { formatCurrency, formatPercent, formatSigma } from "@/lib/format";
import { CASE, CASE_GAP_PERCENT, caseZ } from "@/lib/guide";
import { STATUS_META, STATUS_ORDER, statusStyle } from "@/lib/sigma";
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

const STEPS = [
  {
    title: "The anchor",
    body: "Friday's regular-session close. It is fixed for the whole week — the band does not roll forward, and Wednesday is measured against the same price Monday was.",
  },
  {
    title: "The width",
    body: "The 1σ move the options market prices for the week ahead, as a percentage of the anchor. It comes from implied volatility, not from past returns, so it widens before an earnings week on its own.",
  },
  {
    title: "The reading",
    body: "Distance from the anchor divided by that width. One number, on the same scale for every symbol, which is what makes a $9 name and a $900 name comparable at all.",
  },
];

const MISCONCEPTIONS = [
  {
    wrong: "−1σ means buy",
    right:
      "It means the fall is already larger than the week was priced for. That happens because something changed, and the something is usually still true tomorrow.",
  },
  {
    wrong: "+1σ means sell",
    right:
      "Strong trends spend whole weeks outside the upper edge. A band tells you the move is unusual, not that it is finished.",
  },
  {
    wrong: "A wide band means bullish",
    right:
      "Width is a statement about range, not direction. A ±12% band says the options market expects a big week either way.",
  },
  {
    wrong: "The band reacts to news",
    right:
      "It is struck once, on Friday. An earnings miss on Tuesday does not widen it — which is exactly why a reading can run to −2σ and keep going.",
  },
];

const ROUTINE = [
  "Start with the benchmarks. Where SPY, QQQ and SOXX sit tells you whether a single name has moved or the whole tape has.",
  "Read the sector map. One sector stretched while the rest sit at their anchors is a different story from a board that moved together.",
  "Open the ±1σ lists. These are the names whose week has already exceeded what their own options were priced for.",
  "Check the gamma floors. A −1σ edge with a dominant positive-GEX strike on it is two independent levels agreeing on a price.",
  "Confirm somewhere else. Volume, the news, the options flow, the chart — the board tells you where to look, not what happened.",
  "Decide. A level is a place to watch price react, not an instruction to act when it is touched.",
];

const SURFACES = [
  {
    href: "/",
    name: "Sigma monitor",
    body: "Every tracked symbol with its live reading, grouped by sector when no filter is applied.",
  },
  {
    href: "/screener/above-1-sigma",
    name: "Trading above +1σ",
    body: "Names that have left the upper edge of their own weekly range.",
  },
  {
    href: "/screener/below-1-sigma",
    name: "Trading below −1σ",
    body: "The same on the downside — the list the gamma-floor screen draws from.",
  },
  {
    href: "/screener/gex-floor-at-1-sigma",
    name: "GEX floor at −1σ",
    body: "Where a dominant dealer-gamma strike lands on the −1σ edge. The one screen that combines two independent inputs.",
  },
  {
    href: "/screener/highest-implied-move",
    name: "Widest expected move",
    body: "Where the options market is paying for the most room this week. A range statement, never a direction.",
  },
  {
    href: "/my-sigma",
    name: "My Sigma",
    body: "Your own names only, scored on the same band as everything else.",
  },
];

const FAQ = [
  {
    q: "Why is every symbol at 0.00σ before Monday?",
    a: "Because the band was just struck. Friday's close becomes the new anchor, so until the market trades again every symbol sits exactly on it by construction. On that day the board is showing the range for the week ahead, not a result.",
  },
  {
    q: "Where does the 1σ number come from?",
    a: "From the option-implied move for the week ahead, published by Unusual Whales and converted upstream into a true 1σ. Nothing on this site derives a band from past price movement.",
  },
  {
    q: "Why is this range wider than the expected move I see elsewhere?",
    a: "Most feeds quote the at-the-money straddle scaled by about 0.85, which is roughly a 0.68σ move — the range price stays inside about half the time. A 1σ range is the one price stays inside about 68% of the time, so it is about 1.47 times wider. It is a unit conversion, not a safety margin.",
  },
  {
    q: "What is a GEX floor?",
    a: "A strike below spot where dealers hold enough positive gamma that hedging it means buying into weakness. It is derived from open interest, not from implied volatility, which is why a gamma strike landing on the −1σ edge counts as corroboration rather than the same number said twice.",
  },
  {
    q: "Does a reading past ±1σ mean the move is over?",
    a: "No. It means the move is bigger than the week was priced for. A σ reading measures how unusual a move is; it says nothing about what comes next.",
  },
  {
    q: "How often does the board update?",
    a: "Prices refresh through the session. The band itself is struck once a week from Friday's close and stays fixed until the next one.",
  },
  {
    q: "Is this investment advice?",
    a: "No. Everything here is a measurement of published market data, offered as a way to decide what deserves a closer look.",
  },
];

/** A number and its label, in the mono face the board uses for figures. */
function Fact({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <dt className="label-xs">{label}</dt>
      <dd
        className="num mt-1.5 text-sm"
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

export default async function GuidePage() {
  const { snapshot, all } = await loadBoard();

  const mondayLow = CASE.sessions[0].low;
  const mondayClose = CASE.sessions[0].close;
  const tuesdayHigh = CASE.sessions[1].high;
  const fridayLow = CASE.sessions[4].low;
  const fridayClose = CASE.sessions[4].close;
  const reboundPercent = ((tuesdayHigh - mondayLow) / mondayLow) * 100;

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
      mainEntity: FAQ.map((item) => ({
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

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-10 pb-4 sm:px-6 sm:pt-14 lg:px-8">
        <div className="max-w-2xl">
          <p className="label-xs">Guide</p>
          <h1 className="mt-3 font-heading text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
            <span className="text-gradient">
              Where the market sits inside its own range
            </span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            1SIGMA does not tell you whether a stock is cheap. It tells you how
            much of the move its own options were priced for has already
            happened — and that is a different question, with a different use.
          </p>
        </div>

        <div className="glass mt-9 max-w-4xl px-5 py-7 sm:px-8 sm:py-8">
          <BandDiagram />
        </div>

        <div className="mt-16 space-y-16 sm:mt-20 sm:space-y-20">
          <Section
            eyebrow="Mechanics"
            title="How the band is built"
            description="Three inputs, one of which changes every week and two of which do not move at all once the week starts."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <div key={step.title} className="glass px-5 py-5">
                  <span className="num text-xs text-muted-foreground">
                    0{index + 1}
                  </span>
                  <h3 className="mt-2 text-sm font-semibold">{step.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="glass mt-4 px-5 py-5 sm:px-7">
              <p className="label-xs">Worked example</p>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                A stock closes Friday at $200 and its options price a ±5% week.
                That makes the anchor $200, the lower edge $190 and the upper
                edge $210. Then $205 reads +0.50σ, $210 reads +1.00σ and lands
                on the above-1σ list, and $185 reads −1.50σ and is called
                oversold. The same arithmetic runs on every symbol, which is why
                one board can hold both a $9 stock and a $900 one.
              </p>
            </div>
          </Section>

          <Section
            eyebrow="Reading"
            title="What each reading is called"
            description="Five states, and the board never uses any others. The thresholds are the same ones the upstream weekly alert scores against."
          >
            <div className="glass divide-y divide-border/60">
              {STATUS_ORDER.map((status) => {
                const meta = STATUS_META[status];
                return (
                  <div
                    key={status}
                    style={statusStyle(status)}
                    className="flex flex-col gap-1.5 px-5 py-4 sm:flex-row sm:items-baseline sm:gap-6 sm:px-7"
                  >
                    <div className="flex shrink-0 items-baseline gap-3 sm:w-56">
                      <span className="num state-tint text-sm font-semibold">
                        {meta.label}
                      </span>
                      <span className="num text-xs text-muted-foreground">
                        {meta.longLabel}
                      </span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      {meta.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section
            eyebrow="Limits"
            title="What a reading does not say"
            description="The most expensive way to use this board is to read a band edge as an instruction."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {MISCONCEPTIONS.map((item) => (
                <div key={item.wrong} className="glass px-5 py-5">
                  <p className="text-sm font-semibold text-muted-foreground line-through decoration-[var(--down)] decoration-2">
                    {item.wrong}
                  </p>
                  <p className="mt-2.5 text-[13px] leading-relaxed">
                    {item.right}
                  </p>
                </div>
              ))}
            </div>
          </Section>

          <Section
            eyebrow="Confluence"
            title="1SIGMA × dealer gamma"
            description="The one screen on this site that does not come from the band alone — and the reason a level here is worth more than a round number."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="glass px-5 py-6 sm:px-7">
                <h3 className="text-sm font-semibold">Two different inputs</h3>
                <dl className="mt-4 space-y-4 text-[13px] leading-relaxed">
                  <div>
                    <dt className="num text-xs text-[var(--sigma-lower)]">
                      −1σ
                    </dt>
                    <dd className="mt-1 text-muted-foreground">
                      Comes from implied volatility: what the options market
                      paid for range this week. It is a statement about how far
                      price was expected to travel.
                    </dd>
                  </div>
                  <div>
                    <dt className="num text-xs text-[var(--gex-floor)]">
                      Positive GEX
                    </dt>
                    <dd className="mt-1 text-muted-foreground">
                      Comes from open interest: a strike where dealers are long
                      enough gamma that hedging it means buying into weakness.
                      It is a statement about where flow concentrates.
                    </dd>
                  </div>
                </dl>
                <p className="mt-5 text-[13px] leading-relaxed">
                  Neither is derived from the other. When they land on the same
                  price, the level is corroborated rather than restated — which
                  is the only reason the screen exists.
                </p>
              </div>

              <div className="glass px-5 py-6 sm:px-7">
                <h3 className="text-sm font-semibold">
                  What the screen actually requires
                </h3>
                <ul className="mt-4 space-y-3 text-[13px] leading-relaxed text-muted-foreground">
                  <li>
                    The strongest positive-GEX strike below spot. A secondary
                    strike that happens to line up is a coincidence, not a
                    level.
                  </li>
                  <li>
                    Within half a percent of the −1σ edge — at typical strike
                    spacing, usually one strike wide.
                  </li>
                  <li>
                    At least 15% of the positive gamma sitting near spot, and at
                    least twice the next-strongest strike. A strike can clear
                    one of those on its own and still be noise.
                  </li>
                </ul>
                <p className="mt-5 text-[13px] leading-relaxed">
                  Call the result a reaction zone, not support. Gamma is a
                  position, and positions change — the level can be gone by
                  Thursday.
                </p>
              </div>
            </div>
          </Section>

          <Section
            eyebrow={`Case study · ${CASE.symbol}`}
            title="When the two levels agreed"
            description={`${CASE.name}, band window ${CASE.bandWindow}. The −1σ edge and the week's dominant gamma strike landed ${Math.abs(CASE_GAP_PERCENT).toFixed(2)}% apart — close enough that on a chart they are one line.`}
          >
            <div className="glass px-4 py-6 sm:px-8 sm:py-8">
              <CaseChart />

              <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-border/60 pt-6 sm:grid-cols-3 lg:grid-cols-5">
                <Fact
                  label={`Anchor · Fri ${CASE.anchorDate.slice(5)}`}
                  value={formatCurrency(CASE.anchor)}
                />
                <Fact
                  label="1σ for the week"
                  value={`±${CASE.sigmaPercent.toFixed(2)}%`}
                />
                <Fact
                  label="−1σ edge"
                  value={formatCurrency(CASE.sigma1Lower)}
                  tone="var(--sigma-lower)"
                />
                <Fact
                  label={`Gamma strike · ${formatPercent(CASE_GAP_PERCENT)}`}
                  value={formatCurrency(CASE.gex.strike)}
                  tone="var(--gex-floor)"
                />
                <Fact
                  label="Share of nearby gamma"
                  value={`${CASE.gex.share}% · ${CASE.gex.dominance}× next`}
                  tone="var(--gex-floor)"
                />
              </dl>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="glass px-5 py-5">
                <p className="label-xs">Monday</p>
                <p className="num mt-2 text-lg font-semibold text-down">
                  {formatCurrency(mondayLow)}
                </p>
                <p className="num text-xs text-muted-foreground">
                  {formatSigma(caseZ(mondayLow))} · through both levels
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                  The week opened six percent below the anchor and kept going.
                  The low printed under the gamma strike inside the first hour —
                  and was the only print of the week below it. The close came
                  back to {formatCurrency(mondayClose)},{" "}
                  {formatSigma(caseZ(mondayClose))}. On a daily candle the level
                  held.
                </p>
              </div>

              <div className="glass px-5 py-5">
                <p className="label-xs">Tuesday</p>
                <p className="num mt-2 text-lg font-semibold text-up">
                  {formatCurrency(tuesdayHigh)}
                </p>
                <p className="num text-xs text-muted-foreground">
                  +{reboundPercent.toFixed(1)}% off Monday&rsquo;s low
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                  The session traded up to {formatCurrency(tuesdayHigh)} before
                  giving most of it back. That is the whole case for watching a
                  confluence zone: not that it predicted a bottom, but that the
                  reaction when price reached it was large enough to be worth
                  being early for.
                </p>
              </div>

              <div className="glass px-5 py-5">
                <p className="label-xs">Friday</p>
                <p className="num mt-2 text-lg font-semibold">
                  {formatCurrency(fridayLow)}
                </p>
                <p className="num text-xs text-muted-foreground">
                  {formatSigma(caseZ(fridayLow))} · tested again
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                  Price came back to the same shelf four sessions later, stopped
                  five dollars above the strike, and closed the week at{" "}
                  {formatCurrency(fridayClose)} —{" "}
                  {formatSigma(caseZ(fridayClose))}, inside the band. Twice
                  tested, twice held on a closing basis.
                </p>
              </div>
            </div>

            <div className="glass mt-4 border-l-2 border-l-[var(--gex-floor)] px-5 py-5 sm:px-7">
              <p className="label-xs">The honest part</p>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                The screen only looks at strikes near spot, so it did not name{" "}
                {CASE.symbol} until the {CASE.gex.asOf} board — after
                Monday&rsquo;s test, not before it. The gamma was already there
                on Monday&rsquo;s settlement, and it was the largest
                positive-gamma strike anywhere below spot, but price had not yet
                come close enough for the screen to see it. That is the shape of
                the tool: it narrows a board of {all.length} names down to the
                few worth watching, and it does not time anything. Had the week
                gone the other way, the same two lines would have broken and
                this would be an example in the section above.
              </p>
            </div>
          </Section>

          <Section
            eyebrow="Workflow"
            title="A way to read the board"
            description="Top down, and never starting with the individual name — a symbol at −1σ means something different on a day when forty others are too."
          >
            <ol className="glass divide-y divide-border/60">
              {ROUTINE.map((step, index) => (
                <li
                  key={step}
                  className="flex gap-4 px-5 py-4 text-[13px] leading-relaxed sm:px-7"
                >
                  <span className="num shrink-0 text-xs text-muted-foreground">
                    0{index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section
            eyebrow="Reference"
            title="What each list is for"
            description="Every page reads the same snapshot and the same band. They differ only in what they select."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SURFACES.map((surface) => (
                <Link
                  key={surface.href}
                  href={surface.href}
                  className="glass glass-interactive px-5 py-5"
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    {surface.name}
                    <ArrowRight
                      className="size-3.5 text-muted-foreground"
                      aria-hidden
                    />
                  </span>
                  <span className="mt-2 block text-[13px] leading-relaxed text-muted-foreground">
                    {surface.body}
                  </span>
                </Link>
              ))}
            </div>
          </Section>

          <Section eyebrow="FAQ" title="Questions this board keeps raising">
            <div className="glass divide-y divide-border/60">
              {FAQ.map((item) => (
                <details key={item.q} className="group px-5 py-4 sm:px-7">
                  <summary className="cursor-pointer list-none text-sm font-medium marker:content-none">
                    <span className="flex items-baseline justify-between gap-4">
                      {item.q}
                      <span
                        aria-hidden
                        className="num shrink-0 text-muted-foreground transition-transform group-open:rotate-45"
                      >
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </Section>

          <div className="glass flex flex-col items-start gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-9">
            <div>
              <p className="font-heading text-lg font-semibold tracking-[-0.02em]">
                Band window {snapshot.bandWindow}
              </p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                Anchored on the {snapshot.bandAnchor} close.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Open the board
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter snapshot={snapshot} />
    </>
  );
}
