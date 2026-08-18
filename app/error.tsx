"use client";

import * as React from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Shown when the snapshot cannot be loaded.
 *
 * There is no fallback to the committed development seed on purpose: a board
 * rendered from week-old closes is indistinguishable from a live one at a
 * glance, and acting on it would be worse than seeing nothing. So the failure
 * is stated plainly instead of being papered over.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Snapshot load failed:", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-1 items-center justify-center px-4 py-24 sm:px-6 lg:px-8">
      <div className="glass w-full max-w-md p-6 sm:p-8">
        <span className="flex size-9 items-center justify-center rounded-lg border border-border/70 bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)]">
          <AlertTriangle className="size-4" aria-hidden />
        </span>

        <h1 className="mt-5 font-heading text-xl font-semibold tracking-tight">
          Market data unavailable
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The latest snapshot could not be loaded, so nothing on this page would
          be current. Rather than show stale prices as though they were live,
          the board is withheld until fresh data is available.
        </p>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Snapshots publish after each US close. If this persists, the daily
          publishing job likely did not run.
        </p>

        {error.digest && (
          <p className="num mt-4 text-[11px] text-muted-foreground/60">
            Reference: {error.digest}
          </p>
        )}

        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border/70 bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] px-3.5 py-2 text-xs font-medium transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_9%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <RotateCw className="size-3.5" aria-hidden />
          Try again
        </button>
      </div>
    </main>
  );
}
