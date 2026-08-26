"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { useActiveSection } from "@/hooks/use-active-section";
import type { MarketSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

const LINKS = [
  { id: "market", label: "Market" },
  { id: "watchlist", label: "Watchlist" },
  { id: "lastweek", label: "Last week" },
  { id: "sectors", label: "Sectors" },
];

const SESSION_LABEL: Record<MarketSnapshot["session"], string> = {
  PRE: "Pre-market",
  OPEN: "Market open",
  AFTER: "After hours",
  CLOSED: "Market closed",
};

interface NavBarProps {
  snapshot: MarketSnapshot;
  updatedAt: string;
  /** Omitted on pages that render one snapshot and never re-read it. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /**
   * Whether the in-page section anchors belong in the nav.
   *
   * They only exist on the dashboard. Carrying them onto a symbol or screener
   * page would offer links to headings that are not on it.
   */
  sections?: boolean;
}

const BRAND_CLASS =
  "flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

function Brand() {
  return (
    <>
      <span className="num flex size-7 items-center justify-center rounded-[10px] bg-[linear-gradient(140deg,var(--primary),color-mix(in_oklch,var(--sigma-lower)_75%,var(--primary)))] text-[13px] font-semibold text-primary-foreground shadow-[0_6px_18px_-8px_var(--primary)]">
        σ
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.02em]">
        1SIGMA
      </span>
    </>
  );
}

interface NavLink {
  href: string;
  label: string;
  current: boolean;
  /** In-page anchors stay plain `<a>`; a router push would not scroll. */
  anchor: boolean;
}

/**
 * One nav entry, as either an in-page anchor or a route link.
 *
 * Anchors deliberately stay plain `<a>`: routing "/#watchlist" through the
 * router remounts a force-dynamic page just to move the scroll position.
 */
function NavItem({
  link,
  className,
  underline,
}: {
  link: NavLink;
  className: string;
  underline?: boolean;
}) {
  const content = (
    <>
      {link.label}
      {underline && link.current && (
        <span
          aria-hidden
          className="absolute inset-x-3 -bottom-px h-px bg-[linear-gradient(90deg,transparent,var(--primary),transparent)]"
        />
      )}
    </>
  );

  if (link.anchor) {
    return (
      <a
        href={link.href}
        aria-current={link.current ? "true" : undefined}
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={link.href}
      aria-current={link.current ? "page" : undefined}
      className={className}
    >
      {content}
    </Link>
  );
}

function navLinkClass(current: boolean): string {
  return cn(
    "relative rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    current ? "text-foreground" : "text-muted-foreground hover:text-foreground",
  );
}

export function NavBar({
  snapshot,
  updatedAt,
  onRefresh,
  refreshing = false,
  sections = true,
}: NavBarProps) {
  const active = useActiveSection(sections ? LINKS.map((link) => link.id) : []);
  const pathname = usePathname();
  const isOpen = snapshot.session === "OPEN";

  const links: NavLink[] = [
    ...(sections
      ? LINKS.map((link) => ({
          href: `#${link.id}`,
          label: link.label,
          current: active === link.id,
          anchor: true,
        }))
      : [{ href: "/", label: "Board", current: false, anchor: false }]),
    {
      href: "/my-sigma",
      label: "My Sigma",
      current: pathname === "/my-sigma",
      anchor: false,
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/45">
      {/* Shorter on phones so the second nav row below can carry full-size tap
          targets without the sticky header eating an eighth of the viewport. */}
      <div className="mx-auto flex h-12 w-full max-w-[1600px] items-center gap-4 px-4 sm:h-14 sm:px-6 lg:px-8">
        {sections ? (
          <a href="#top" className={BRAND_CLASS}>
            <Brand />
          </a>
        ) : (
          <Link href="/" className={BRAND_CLASS}>
            <Brand />
          </Link>
        )}

        <nav
          aria-label="Sections"
          className="hidden flex-1 justify-center md:flex"
        >
          <ul className="flex items-center gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <NavItem
                  link={link}
                  className={navLinkClass(link.current)}
                  underline
                />
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <span className="hidden items-center gap-2 rounded-full border border-border/70 py-1 pr-3 pl-2.5 sm:flex">
            <span className="relative flex size-1.5">
              {isOpen && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-up opacity-60" />
              )}
              <span
                className={cn(
                  "relative inline-flex size-1.5 rounded-full",
                  isOpen ? "bg-up" : "bg-muted-foreground",
                )}
              />
            </span>
            <span className="text-[11px] font-medium whitespace-nowrap">
              {SESSION_LABEL[snapshot.session]}
            </span>
          </span>

          <span className="num hidden text-[11px] whitespace-nowrap text-muted-foreground lg:inline">
            Updated {updatedAt}
          </span>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh quotes"
              className="flex size-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-border hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
            >
              <RefreshCw
                className={cn("size-3.5", refreshing && "animate-spin")}
                aria-hidden
              />
            </button>
          )}

          <ThemeToggle />
        </div>
      </div>

      <nav
        aria-label="Sections"
        className="flex items-center gap-1 overflow-x-auto border-t border-border/50 px-3 py-1 md:hidden"
      >
        {links.map((link) => (
          <NavItem
            key={link.href}
            link={link}
            className={cn(
              "inline-flex min-h-9 shrink-0 items-center rounded-full px-3 text-xs font-medium transition-colors",
              link.current
                ? "bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)] text-foreground"
                : "text-muted-foreground",
            )}
          />
        ))}
      </nav>
    </header>
  );
}
