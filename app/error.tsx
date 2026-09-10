"use client";

import * as React from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

import { useLocale } from "@/components/locale-provider";

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
  const { pick } = useLocale();
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
          {pick("시장 데이터를 사용할 수 없습니다", "Market data unavailable")}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {pick("최신 스냅샷을 불러오지 못해 현재 데이터를 표시할 수 없습니다. 오래된 가격을 실시간처럼 보여주지 않고, 새 데이터가 준비될 때까지 보드를 숨깁니다.", "The latest snapshot could not be loaded, so nothing on this page would be current. Rather than show stale prices as though they were live, the board is withheld until fresh data is available.")}
        </p>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {pick("스냅샷은 미국장 마감 후 발행됩니다. 계속되면 일일 발행 작업이 실행되지 않았을 가능성이 큽니다.", "Snapshots publish after each US close. If this persists, the daily publishing job likely did not run.")}
        </p>

        {error.digest && (
          <p className="num mt-4 text-[11px] text-muted-foreground/60">
            {pick("참조", "Reference")}: {error.digest}
          </p>
        )}

        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border/70 bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] px-3.5 py-2 text-xs font-medium transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_9%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <RotateCw className="size-3.5" aria-hidden />
          {pick("다시 시도", "Try again")}
        </button>
      </div>
    </main>
  );
}
