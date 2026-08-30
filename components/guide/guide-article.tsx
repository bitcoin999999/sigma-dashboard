"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BandDiagram } from "@/components/guide/band-diagram";
import { CaseChart } from "@/components/guide/case-chart";
import { Section } from "@/components/layout/section";
import {
  formatBandWindow,
  formatCurrency,
  formatDay,
  formatPercent,
  formatSigma,
} from "@/lib/format";
import { CASE, CASE_GAP_PERCENT, caseZ } from "@/lib/guide";
import {
  GUIDE_COPY,
  LANGS,
  LANG_STORAGE_KEY,
  type Lang,
  isLang,
} from "@/lib/guide-copy";
import { STATUS_META, STATUS_ORDER, statusStyle } from "@/lib/sigma";
import { cn } from "@/lib/utils";

/**
 * The chosen language, kept in `localStorage` and read through
 * `useSyncExternalStore` so the server renders English and the client
 * re-renders once, without a hydration mismatch.
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab switching language fires `storage` here, never in the tab
  // that wrote it — hence the explicit notify in `setStoredLang`.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getStoredLang(): Lang {
  const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
  return isLang(saved) ? saved : "en";
}

function setStoredLang(next: Lang) {
  window.localStorage.setItem(LANG_STORAGE_KEY, next);
  listeners.forEach((listener) => listener());
}

/** The order the reference cards appear in, and the routes they link to. */
const SURFACE_HREFS = [
  "/",
  "/screener/above-1-sigma",
  "/screener/below-1-sigma",
  "/screener/gex-floor-at-1-sigma",
  "/screener/highest-implied-move",
  "/my-sigma",
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

function LangToggle({
  lang,
  onChange,
}: {
  lang: Lang;
  onChange: (next: Lang) => void;
}) {
  return (
    <div className="inline-flex shrink-0 rounded-full border border-border/70 p-0.5">
      {LANGS.map((option) => {
        const copy = GUIDE_COPY[option];
        const active = option === lang;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-label={copy.switchAria}
            aria-pressed={active}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {copy.switchLabel}
          </button>
        );
      })}
    </div>
  );
}

interface GuideArticleProps {
  /** ISO anchor date. Spelled here rather than upstream so the month name
   * follows the language the reader picked. */
  bandAnchorDate: string;
  /** How many symbols the live board carries, quoted in the case study. */
  symbolCount: number;
}

const LOCALE: Record<Lang, string> = { en: "en-US", ko: "ko-KR" };

/**
 * The guide, in whichever language the reader picked.
 *
 * The page around it stays a server component: metadata, the JSON-LD and the
 * snapshot read all belong there, and search engines should keep seeing the
 * English article. Only the body swaps, and the choice is remembered in
 * `localStorage` rather than the URL so the nav and footer links stay simple.
 */
export function GuideArticle({
  bandAnchorDate,
  symbolCount,
}: GuideArticleProps) {
  const lang = useSyncExternalStore(subscribe, getStoredLang, (): Lang => "en");
  const t = GUIDE_COPY[lang];
  const locale = LOCALE[lang];

  const mondayLow = CASE.sessions[0].low;
  const mondayClose = CASE.sessions[0].close;
  const tuesdayHigh = CASE.sessions[1].high;
  const fridayLow = CASE.sessions[4].low;
  const fridayClose = CASE.sessions[4].close;
  const reboundPercent = ((tuesdayHigh - mondayLow) / mondayLow) * 100;

  return (
    <main
      lang={lang}
      className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-10 pb-4 sm:px-6 sm:pt-14 lg:px-8"
    >
      <div className="flex items-start justify-between gap-6">
        <div className="max-w-2xl">
          <p className="label-xs">{t.eyebrow}</p>
          <h1 className="mt-3 font-heading text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
            <span className="text-gradient">{t.title}</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {t.intro}
          </p>
        </div>
        <LangToggle lang={lang} onChange={setStoredLang} />
      </div>

      <div className="glass mt-9 max-w-4xl px-5 py-7 sm:px-8 sm:py-8">
        <BandDiagram lang={lang} />
      </div>

      <div className="mt-16 space-y-16 sm:mt-20 sm:space-y-20">
        <Section
          eyebrow={t.mechanics.eyebrow}
          title={t.mechanics.title}
          description={t.mechanics.description}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {t.mechanics.steps.map((step, index) => (
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
            <p className="label-xs">{t.mechanics.exampleLabel}</p>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              {t.mechanics.example}
            </p>
          </div>
        </Section>

        <Section
          eyebrow={t.reading.eyebrow}
          title={t.reading.title}
          description={t.reading.description}
        >
          <div className="glass divide-y divide-border/60">
            {STATUS_ORDER.map((status) => {
              const meta = STATUS_META[status];
              const state = t.reading.status[status];
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
                      {state.longLabel}
                    </span>
                  </div>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    {state.description}
                  </p>
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          eyebrow={t.limits.eyebrow}
          title={t.limits.title}
          description={t.limits.description}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {t.limits.items.map((item) => (
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
          eyebrow={t.confluence.eyebrow}
          title={t.confluence.title}
          description={t.confluence.description}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="glass px-5 py-6 sm:px-7">
              <h3 className="text-sm font-semibold">
                {t.confluence.inputsTitle}
              </h3>
              <dl className="mt-4 space-y-4 text-[13px] leading-relaxed">
                <div>
                  <dt className="num text-xs text-[var(--sigma-lower)]">
                    {t.confluence.sigmaTerm}
                  </dt>
                  <dd className="mt-1 text-muted-foreground">
                    {t.confluence.sigmaBody}
                  </dd>
                </div>
                <div>
                  <dt className="num text-xs text-[var(--gex-floor)]">
                    {t.confluence.gexTerm}
                  </dt>
                  <dd className="mt-1 text-muted-foreground">
                    {t.confluence.gexBody}
                  </dd>
                </div>
              </dl>
              <p className="mt-5 text-[13px] leading-relaxed">
                {t.confluence.inputsNote}
              </p>
            </div>

            <div className="glass px-5 py-6 sm:px-7">
              <h3 className="text-sm font-semibold">
                {t.confluence.rulesTitle}
              </h3>
              <ul className="mt-4 space-y-3 text-[13px] leading-relaxed text-muted-foreground">
                {t.confluence.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
              <p className="mt-5 text-[13px] leading-relaxed">
                {t.confluence.rulesNote}
              </p>
            </div>
          </div>
        </Section>

        <Section
          eyebrow={t.caseStudy.eyebrow(CASE.symbol)}
          title={t.caseStudy.title}
          description={t.caseStudy.description(
            CASE.name,
            t.caseStudy.bandWindow,
            Math.abs(CASE_GAP_PERCENT).toFixed(2),
          )}
        >
          <div className="glass px-4 py-6 sm:px-8 sm:py-8">
            <CaseChart lang={lang} />

            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-border/60 pt-6 sm:grid-cols-3 lg:grid-cols-5">
              <Fact
                label={t.caseStudy.anchorLabel(CASE.anchorDate.slice(5))}
                value={formatCurrency(CASE.anchor)}
              />
              <Fact
                label={t.caseStudy.widthLabel}
                value={`±${CASE.sigmaPercent.toFixed(2)}%`}
              />
              <Fact
                label={t.caseStudy.lowerEdgeLabel}
                value={formatCurrency(CASE.sigma1Lower)}
                tone="var(--sigma-lower)"
              />
              <Fact
                label={t.caseStudy.gammaStrikeLabel(
                  formatPercent(CASE_GAP_PERCENT),
                )}
                value={formatCurrency(CASE.gex.strike)}
                tone="var(--gex-floor)"
              />
              <Fact
                label={t.caseStudy.shareLabel}
                value={t.caseStudy.shareValue(
                  CASE.gex.share,
                  CASE.gex.dominance,
                )}
                tone="var(--gex-floor)"
              />
            </dl>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="glass px-5 py-5">
              <p className="label-xs">{t.caseStudy.monday.day}</p>
              <p className="num mt-2 text-lg font-semibold text-down">
                {formatCurrency(mondayLow)}
              </p>
              <p className="num text-xs text-muted-foreground">
                {formatSigma(caseZ(mondayLow))} · {t.caseStudy.monday.meta}
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                {t.caseStudy.monday.body(
                  formatCurrency(mondayClose),
                  formatSigma(caseZ(mondayClose)),
                )}
              </p>
            </div>

            <div className="glass px-5 py-5">
              <p className="label-xs">{t.caseStudy.tuesday.day}</p>
              <p className="num mt-2 text-lg font-semibold text-up">
                {formatCurrency(tuesdayHigh)}
              </p>
              <p className="num text-xs text-muted-foreground">
                {t.caseStudy.tuesday.meta(reboundPercent.toFixed(1))}
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                {t.caseStudy.tuesday.body(formatCurrency(tuesdayHigh))}
              </p>
            </div>

            <div className="glass px-5 py-5">
              <p className="label-xs">{t.caseStudy.friday.day}</p>
              <p className="num mt-2 text-lg font-semibold">
                {formatCurrency(fridayLow)}
              </p>
              <p className="num text-xs text-muted-foreground">
                {formatSigma(caseZ(fridayLow))} · {t.caseStudy.friday.meta}
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                {t.caseStudy.friday.body(
                  formatCurrency(fridayClose),
                  formatSigma(caseZ(fridayClose)),
                )}
              </p>
            </div>
          </div>

          <div className="glass mt-4 border-l-2 border-l-[var(--gex-floor)] px-5 py-5 sm:px-7">
            <p className="label-xs">{t.caseStudy.honestLabel}</p>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              {t.caseStudy.honest(CASE.symbol, CASE.gex.asOf, symbolCount)}
            </p>
          </div>
        </Section>

        <Section
          eyebrow={t.workflow.eyebrow}
          title={t.workflow.title}
          description={t.workflow.description}
        >
          <ol className="glass divide-y divide-border/60">
            {t.workflow.steps.map((step, index) => (
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
          eyebrow={t.reference.eyebrow}
          title={t.reference.title}
          description={t.reference.description}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SURFACE_HREFS.map((href) => {
              const surface = t.reference.surfaces[href];
              return (
                <Link
                  key={href}
                  href={href}
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
              );
            })}
          </div>
        </Section>

        <Section eyebrow={t.faq.eyebrow} title={t.faq.title}>
          <div className="glass divide-y divide-border/60">
            {t.faq.items.map((item) => (
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
              {t.cta.window(formatBandWindow(bandAnchorDate, locale))}
            </p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {t.cta.anchor(formatDay(bandAnchorDate, locale))}
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t.cta.open}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </main>
  );
}
