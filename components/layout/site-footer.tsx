"use client";

import Link from "next/link";

import { useLocale } from "@/components/locale-provider";
import { SCREENERS } from "@/lib/screeners";
import type { MarketSnapshot } from "@/lib/types";

const FOOTER_LINK =
  "rounded text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * The footer is the one block every route renders, which makes it the place to
 * guarantee that no page is reachable only by typing its address.
 */
function FooterNav({ sessionDate }: { sessionDate: string }) {
  const { locale, pick } = useLocale();

  return (
    <nav aria-label={pick("하단 메뉴", "Footer")} className="grid grid-cols-2 gap-x-10 gap-y-3">
      <Link href="/" className={FOOTER_LINK}>
        {pick("보드", "Board")}
      </Link>
      <Link href="/my-sigma" className={FOOTER_LINK}>
        My Sigma
      </Link>
      <Link href="/calculator" className={FOOTER_LINK}>
        {pick("계산기", "Calculator")}
      </Link>
      <Link href="/guide" className={FOOTER_LINK}>
        {pick("가이드", "Guide")}
      </Link>
      {SCREENERS.map((screener) => (
        <Link
          key={screener.slug}
          href={`/screener/${screener.slug}`}
          className={FOOTER_LINK}
        >
          {screener.copy[locale].title}
        </Link>
      ))}
      {/* Built from the snapshot, not from today's clock: the card route
          answers for exactly one session and 404s on any other date. */}
      <Link href={`/daily/${sessionDate}`} className={FOOTER_LINK}>
        {pick("오늘의 카드", "Today’s card")}
      </Link>
    </nav>
  );
}

export function SiteFooter({ snapshot }: { snapshot: MarketSnapshot }) {
  const { pick } = useLocale();

  return (
    <footer className="mt-20 border-t border-border/60">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span className="num flex size-6 items-center justify-center rounded-lg bg-[linear-gradient(140deg,var(--primary),color-mix(in_oklch,var(--sigma-lower)_75%,var(--primary)))] text-[11px] font-semibold text-primary-foreground">
                σ
              </span>
              <span className="text-sm font-semibold tracking-[-0.02em]">
                1SIGMA
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {pick("단순한 가격 목록이 아닌, 각 종목이 자신의 expected range 안에서 어디에 있는지 보여주는 통계적 시장 뷰입니다.", "A statistical view of the market: where each symbol sits inside its own expected range, rather than another list of prices.")}
            </p>
          </div>

          <FooterNav sessionDate={snapshot.sessionDate} />

          <dl className="grid grid-cols-2 gap-x-10 gap-y-4">
            <div>
              <dt className="label-xs">{pick("밴드 앵커", "Band anchor")}</dt>
              <dd className="num mt-1.5 text-xs">{snapshot.bandAnchor}</dd>
            </div>
            <div>
              <dt className="label-xs">{pick("밴드 기간", "Band window")}</dt>
              <dd className="num mt-1.5 text-xs">{snapshot.bandWindow}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-9 flex flex-col gap-2 border-t border-border/50 pt-6 text-[11px] text-muted-foreground/70 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {pick("정규장 마감가와 option-implied move 데이터를 사용합니다. 투자 조언이 아닙니다.", "Settled regular-session closes and option-implied move data. Not investment advice.")}
          </p>
          <p className="num">1σ ≈ 68% of expected outcomes</p>
        </div>
      </div>
    </footer>
  );
}
