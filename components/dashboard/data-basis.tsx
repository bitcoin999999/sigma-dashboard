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
  ];

  return (
    <details className={cn("group text-[11px]", className)}>
      <summary className="flex cursor-pointer list-none items-baseline gap-2 text-muted-foreground/70 [&::-webkit-details-marker]:hidden">
        <span className="label-xs">Published</span>
        <span className="num text-xs text-foreground/85">
          {formatEastern(snapshot.generatedAt)}
        </span>
        <span className="ml-auto underline decoration-dotted underline-offset-4 group-open:no-underline">
          <span className="group-open:hidden">Data basis</span>
          <span className="hidden group-open:inline">Hide</span>
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
        A daily snapshot, not a live quote. Prices are taken as the upstream
        feed supplies them.
      </p>
    </details>
  );
}
