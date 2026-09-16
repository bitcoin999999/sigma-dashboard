"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import { useLocale } from "@/components/locale-provider";
import { matchingTickers, tickerDirectory, type TickerSearchItem } from "@/lib/ticker-search";
import { cn } from "@/lib/utils";

export function TickerSearch({ items }: { items: readonly TickerSearchItem[] }) {
  const { pick } = useLocale();
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const directory = useMemo(() => tickerDirectory(items), [items]);
  const matches = matchingTickers(directory, query);
  const expanded = open && query.trim().length > 0;
  const selected = Math.min(active, Math.max(0, matches.length - 1));

  useEffect(() => {
    if (expanded) list.current?.children[selected]?.scrollIntoView({ block: "nearest" });
  }, [expanded, selected]);

  const close = () => { setOpen(false); setQuery(""); setActive(0); };
  const href = (symbol: string) => `/symbol/${encodeURIComponent(symbol)}`;

  return (
    <div className="relative min-w-0 flex-1 sm:w-44 sm:flex-none xl:w-48"
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input ref={input} role="combobox" aria-autocomplete="list" aria-expanded={expanded}
        aria-controls={expanded ? `${id}-list` : undefined}
        aria-activedescendant={expanded && matches.length ? `${id}-${selected}` : undefined}
        aria-label={pick("티커 검색", "Search ticker")} placeholder={pick("티커 검색", "Ticker")}
        autoComplete="off" autoCapitalize="characters" spellCheck={false} value={query}
        className="h-8 w-full min-w-0 rounded-lg border border-border/70 bg-background/50 pr-7 pl-7 text-base outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25 sm:text-sm"
        onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true);
            if (matches.length) setActive(!expanded ? (event.key === "ArrowDown" ? 0 : matches.length - 1) :
              (selected + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length);
          }
          if (event.key === "Enter" && expanded && matches[selected]) {
            event.preventDefault(); router.push(href(matches[selected].symbol)); close();
          }
        }} />
      {query && <button type="button" aria-label={pick("검색 초기화", "Clear search")}
        onClick={() => { close(); input.current?.focus(); }}
        className="absolute top-1/2 right-1 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
        <X aria-hidden className="size-3.5" />
      </button>}
      {expanded && <div className="fixed inset-x-4 top-12 z-50 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-80">
        <p role="status" className="border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
          {matches.length ? pick(`${matches.length}개 티커`, `${matches.length} tickers`) : pick("일치하는 티커가 없습니다", "No matching tickers")}
        </p>
        <ul ref={list} id={`${id}-list`} role="listbox" aria-label={pick("티커 검색 결과", "Ticker search results")} className="max-h-72 overflow-y-auto overscroll-contain py-1">
          {matches.map((item, index) => <li key={item.symbol} id={`${id}-${index}`} role="option" aria-selected={selected === index}>
            <Link href={href(item.symbol)} prefetch={false} tabIndex={-1}
              onMouseEnter={() => setActive(index)} onMouseDown={(event) => event.preventDefault()} onClick={close}
              className={cn("flex min-h-11 items-center gap-3 px-3 py-2 text-sm", selected === index && "bg-accent text-accent-foreground")}>
              <span className="num min-w-14 shrink-0 font-semibold">{item.symbol}</span>
              <span className="truncate text-xs text-muted-foreground">{item.name}</span>
            </Link>
          </li>)}
        </ul>
      </div>}
    </div>
  );
}
