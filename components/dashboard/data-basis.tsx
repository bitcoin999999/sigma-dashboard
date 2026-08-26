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
  const rows = [
    { term: "Price basis", detail: "Regular-session close" },
    { term: "Extended hours", detail: "Excluded" },
    { term: "Last observation", detail: snapshot.updatedAt },
    {
      term: "Adjustment",
      detail: "As supplied upstream; not re-adjusted here",
    },
    { term: "Published", detail: formatEastern(snapshot.generatedAt) },
  ];

  return (
    <div className={cn("glass p-4", className)}>
      <p className="label-xs">Data basis</p>

      <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div
            key={row.term}
            className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-2 sm:border-0 sm:pb-0"
          >
            <dt className="text-[11px] whitespace-nowrap text-muted-foreground/80">
              {row.term}
            </dt>
            <dd className="num text-right text-[11px] text-foreground/85">
              {row.detail}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/70">
        A daily snapshot, not a live quote. Prices are taken as the upstream
        feed supplies them.
      </p>
    </div>
  );
}
