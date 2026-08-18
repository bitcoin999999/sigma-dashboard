import type { MarketSnapshot } from "@/lib/types";

export function SiteFooter({ snapshot }: { snapshot: MarketSnapshot }) {
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
              A statistical view of the market: where each symbol sits inside
              its own expected range, rather than another list of prices.
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-3">
            <div>
              <dt className="label-xs">Band anchor</dt>
              <dd className="num mt-1.5 text-xs">{snapshot.bandAnchor}</dd>
            </div>
            <div>
              <dt className="label-xs">Band window</dt>
              <dd className="num mt-1.5 text-xs">{snapshot.bandWindow}</dd>
            </div>
            <div>
              <dt className="label-xs">Data source</dt>
              <dd className="num mt-1.5 text-xs">Unusual Whales</dd>
            </div>
          </dl>
        </div>

        <div className="mt-9 flex flex-col gap-2 border-t border-border/50 pt-6 text-[11px] text-muted-foreground/70 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Settled regular-session closes and implied-move data from Unusual
            Whales. Not investment advice.
          </p>
          <p className="num">1σ ≈ 68% of expected outcomes</p>
        </div>
      </div>
    </footer>
  );
}
