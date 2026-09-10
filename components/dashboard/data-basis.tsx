"use client";

import { useLocale } from "@/components/locale-provider";
import { formatEastern } from "@/lib/format";
import type { MarketSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * What the numbers on this board actually are.
 *
 * Every line here is something the snapshot contract genuinely states. It
 * deliberately does *not* claim a delay window or a corporate-action policy:
 * the publisher makes no promise about either, and a wrong "delayed 15 min" or
 * "split-adjusted" label is worse than no label — it is a claim a reader would
 * act on.
 */
export function DataBasis({
  snapshot,
  className,
}: {
  snapshot: MarketSnapshot;
  className?: string;
}) {
  const { pick } = useLocale();
  const rows = [
    { term: pick("가격 기준", "Price basis"), detail: pick("정규장 마감", "Regular-session close") },
    { term: pick("장외거래", "Extended hours"), detail: pick("제외", "Excluded") },
    { term: pick("최종 관측", "Last observation"), detail: snapshot.updatedAt },
    {
      term: pick("조정", "Adjustment"),
      detail: pick("원천 데이터 기준, 여기서 재조정하지 않음", "As supplied upstream; not re-adjusted here"),
    },
  ];

  return (
    <details className={cn("group text-[11px]", className)}>
      <summary className="flex cursor-pointer list-none items-baseline gap-2 text-muted-foreground/70 [&::-webkit-details-marker]:hidden">
        <span className="label-xs">{pick("발행", "Published")}</span>
        <span className="num text-xs text-foreground/85">
          {formatEastern(snapshot.generatedAt)}
        </span>
        <span className="ml-auto underline decoration-dotted underline-offset-4 group-open:no-underline">
          <span className="group-open:hidden">{pick("데이터 기준", "Data basis")}</span>
          <span className="hidden group-open:inline">{pick("숨기기", "Hide")}</span>
        </span>
      </summary>

      <dl className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1 border-t border-border/40 pt-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.term} className="flex items-baseline justify-between gap-3">
            <dt className="whitespace-nowrap text-muted-foreground/70">
              {row.term}
            </dt>
            <dd className="num text-right text-muted-foreground/85">
              {row.detail}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-2 text-muted-foreground/60">
        {pick("실시간 시세가 아닌 일일 스냅샷입니다. 가격은 원천 피드가 제공한 값을 그대로 사용합니다.", "A daily snapshot, not a live quote. Prices are taken as the upstream feed supplies them.")}
      </p>
    </details>
  );
}
