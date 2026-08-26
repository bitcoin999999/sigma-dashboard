"use client";

import * as React from "react";
import { ArrowUpDown, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FILTER_OPTIONS, SORT_OPTIONS } from "@/lib/sigma";
import type { FilterKey, SortKey, ViewMode } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ViewToggle } from "./view-toggle";

interface ControlsBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  filter: FilterKey;
  onFilterChange: (value: FilterKey) => void;
  sort: SortKey;
  onSortChange: (value: SortKey) => void;
  view: ViewMode;
  onViewChange: (value: ViewMode) => void;
  filterCounts: Record<FilterKey, number>;
}

export function ControlsBar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  view,
  onViewChange,
  filterCounts,
}: ControlsBarProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  // "/" jumps to search the way a terminal would.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:px-0 lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Filter by sigma status"
      >
        {FILTER_OPTIONS.map((option) => {
          const active = option.key === filter;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onFilterChange(option.key)}
              aria-pressed={active}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                active
                  ? "border-transparent bg-foreground text-background"
                  : "border-border/80 text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {option.label}
              <span
                className={cn(
                  "num text-[10px]",
                  active ? "text-background/60" : "text-muted-foreground/60",
                )}
              >
                {filterCounts[option.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 lg:w-56 lg:flex-none">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search ticker"
            aria-label="Search ticker"
            className="h-8 pr-8 pl-8 text-sm"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <kbd className="num pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-border/80 px-1 text-[10px] text-muted-foreground/70 lg:block">
              /
            </kbd>
          )}
        </div>

        <Select
          value={sort}
          onValueChange={(value) => onSortChange(value as SortKey)}
          items={SORT_OPTIONS.map((option) => ({
            value: option.key,
            label: option.label,
          }))}
        >
          <SelectTrigger
            aria-label="Sort stocks"
            className="h-8 min-w-[9.5rem] gap-2"
          >
            <ArrowUpDown
              className="size-3.5 text-muted-foreground"
              aria-hidden
            />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ViewToggle value={view} onChange={onViewChange} />
      </div>
    </div>
  );
}
