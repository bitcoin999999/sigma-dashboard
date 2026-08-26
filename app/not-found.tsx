import Link from "next/link";
import { Compass } from "lucide-react";

import { SCREENERS } from "@/lib/screeners";

const PILL =
  "inline-flex h-9 items-center rounded-full border border-border/80 px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Reached deliberately, not only by typos: an unknown ticker, an unrecognised
 * screener slug, and a daily card whose date is not the one session the app
 * holds all resolve here rather than rendering current numbers under the
 * wrong label.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-1 items-center justify-center px-4 py-24 sm:px-6 lg:px-8">
      <div className="glass w-full max-w-md p-6 sm:p-8">
        <span className="flex size-9 items-center justify-center rounded-lg border border-border/70 bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)]">
          <Compass className="size-4" aria-hidden />
        </span>

        <h1 className="mt-5 font-heading text-xl font-semibold tracking-tight">
          Nothing at this address
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The board tracks a fixed list of symbols and holds one session at a
          time. A ticker outside that list, or a daily card dated to any other
          session, has no data behind it — so it is refused rather than filled
          in with today&apos;s numbers.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/" className={PILL}>
            See the whole board
          </Link>
          <Link href="/my-sigma" className={PILL}>
            My Sigma
          </Link>
          {SCREENERS.map((screener) => (
            <Link
              key={screener.slug}
              href={`/screener/${screener.slug}`}
              className={PILL}
            >
              {screener.title}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
