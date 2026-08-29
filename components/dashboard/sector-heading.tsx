import { formatSigma } from "@/lib/format";
import type { SectorGroup } from "@/lib/sigma";
import { cn } from "@/lib/utils";

/**
 * The one-line read on a sector, above its members.
 *
 * The count past ±1σ leads because it is the question the block is being
 * scanned for; the median follows to say whether that count is the sector
 * leaning as a whole or two names running away from a flat group.
 */
export function SectorHeading({
  group,
  className,
}: {
  group: SectorGroup;
  className?: string;
}) {
  const leaning = Math.abs(group.medianZ) >= 0.5;

  return (
    <div
      className={cn(
        "mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border/50 pb-2",
        className,
      )}
    >
      <h3 className="text-[13px] font-semibold tracking-[-0.01em]">
        {group.sector}
      </h3>
      <span className="num text-[11px] text-muted-foreground/70">
        {group.stocks.length}
      </span>

      <span className="num ml-auto flex items-baseline gap-3 text-[11px]">
        {group.dislocated > 0 && (
          <span className="text-foreground/80">
            {group.dislocated} past ±1σ
          </span>
        )}
        <span
          className={cn(
            leaning
              ? group.medianZ > 0
                ? "text-up"
                : "text-down"
              : "text-muted-foreground/70",
          )}
        >
          median {formatSigma(group.medianZ, 2)}
        </span>
      </span>
    </div>
  );
}
