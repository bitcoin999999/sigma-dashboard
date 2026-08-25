"use client";

import * as React from "react";

import { formatCurrency, formatPercent, formatSigma } from "@/lib/format";
import { BAND_LIMIT, statusStyle } from "@/lib/sigma";
import { type Rect, type TreemapTile, inset, squarify } from "@/lib/treemap";
import type { SectorEtfData, StockData } from "@/lib/types";
import { cn } from "@/lib/utils";

type TreemapMode = "STOCKS" | "SECTORS";

const MODES: { key: TreemapMode; label: string }[] = [
  { key: "STOCKS", label: "Stocks" },
  { key: "SECTORS", label: "Sector ETFs" },
];

/** Height of a group's caption bar, in px. Matches the label's line box. */
const GROUP_HEADER = 19;
/** Gutter between tiles. Small on purpose — density is the point. */
const GAP = 2;
/** Breathing room between one group's frame and the next. */
const GROUP_GAP = 3;
/** Padding inside a group frame, below the caption. */
const GROUP_PAD = 4;

interface SectorTreemapProps {
  stocks: StockData[];
  etfs: SectorEtfData[];
  onSelect: (symbol: string) => void;
}

interface Group {
  key: string;
  label: string;
  members: StockData[];
}

/**
 * Groups stocks by their theme, largest group first.
 *
 * Group order only affects tie-breaks inside the packer; `squarify` sorts by
 * weight itself.
 */
function groupStocks(stocks: StockData[]): Group[] {
  const buckets = new Map<string, StockData[]>();

  for (const stock of stocks) {
    const existing = buckets.get(stock.sector);
    if (existing) existing.push(stock);
    else buckets.set(stock.sector, [stock]);
  }

  return [...buckets.entries()].map(([label, members]) => ({
    key: label,
    label,
    // Within a group the loudest dislocation reads first.
    members: [...members].sort((a, b) => b.zScore - a.zScore),
  }));
}

/**
 * Tile fill and border, driven by band position.
 *
 * Hue carries direction and stage (±1σ vs ±1.5σ); opacity carries distance.
 * Finviz encodes one variable — the daily move — in a single red/green ramp;
 * here the ramp is the σ status, so the map keeps saying the same thing as the
 * rest of the page rather than introducing a second, competing scale.
 */
function tileTone(zScore: number) {
  const intensity = Math.min(Math.abs(zScore) / BAND_LIMIT, 1);
  return {
    fill: 12 + intensity * 48,
    edge: 24 + intensity * 34,
  };
}

export function SectorTreemap({
  stocks,
  etfs,
  onSelect,
}: SectorTreemapProps) {
  const [mode, setMode] = React.useState<TreemapMode>("STOCKS");
  const containerRef = React.useRef<HTMLDivElement>(null);

  // The packer needs real pixels: a squarified layout computed for one aspect
  // ratio looks wrong at another, so it is recomputed on resize rather than
  // expressed in percentages.
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const groups = React.useMemo<Group[]>(
    () =>
      mode === "STOCKS"
        ? groupStocks(stocks)
        : // Sector ETFs have no second level: each fund is its own group of one,
          // rendered without a caption bar.
          etfs.map((etf) => ({
            key: etf.symbol,
            label: etf.sectorLabel,
            members: [etf],
          })),
    [mode, stocks, etfs],
  );

  const layout = React.useMemo(() => {
    if (size.width <= 0 || size.height <= 0) return [];

    const canvas: Rect = {
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
    };

    const nested = mode === "STOCKS";

    const groupTiles = squarify(
      groups.map((group) => ({
        key: group.key,
        // Group area tracks how many symbols it holds. There is no market-cap
        // field in the snapshot, and inventing one would make the map look
        // more authoritative than the data behind it.
        weight: group.members.length,
        data: group,
      })),
      canvas,
    );

    return groupTiles.map((groupTile) => {
      // The frame sits inside the packed rect so neighbouring groups read as
      // separate blocks rather than one continuous field of tiles.
      const frame = nested ? inset(groupTile, GROUP_GAP) : { ...groupTile };
      const body = nested
        ? inset(frame, GROUP_HEADER, GROUP_PAD)
        : { ...groupTile };

      const children = squarify(
        groupTile.data.members.map((member) => ({
          key: member.symbol,
          // Equal weight inside a group — see the note above.
          weight: 1,
          data: member,
        })),
        body,
      );

      return { group: groupTile, frame, children };
    });
  }, [groups, mode, size]);

  const isNested = mode === "STOCKS";
  const total = isNested ? stocks.length : etfs.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-full border border-border/70 p-1">
          {MODES.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setMode(option.key)}
              aria-pressed={mode === option.key}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                mode === option.key
                  ? "bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)] text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <span className="num text-xs text-muted-foreground">
          {total} {isNested ? "symbols" : "funds"} · area ={" "}
          {isNested ? "group size" : "equal"}
        </span>
      </div>

      <div
        ref={containerRef}
        className="glass relative aspect-[3/4] w-full overflow-hidden p-1.5 sm:aspect-[4/3] lg:aspect-[16/10]"
      >
        {layout.map(({ group, frame, children }) => (
          <React.Fragment key={group.key}>
            {isNested && (
              <div
                aria-hidden
                className="pointer-events-none absolute rounded-md border border-border/60 bg-[color-mix(in_oklch,var(--foreground)_3%,transparent)]"
                style={{
                  left: frame.x,
                  top: frame.y,
                  width: frame.width,
                  height: frame.height,
                }}
              >
                <span className="block truncate px-1.5 text-[11px] leading-[19px] font-medium tracking-[0.08em] text-muted-foreground/80 uppercase">
                  {group.data.label}
                </span>
              </div>
            )}

            {children.map((tile) => (
              <TreemapCell
                key={tile.key}
                tile={tile}
                onSelect={onSelect}
                showSector={!isNested}
              />
            ))}
          </React.Fragment>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Tile colour is band position, not the daily move — the same scale used
        everywhere else on this page. Area reflects how many symbols a group
        holds, not market value.
      </p>
    </div>
  );
}

interface TreemapCellProps {
  tile: TreemapTile<StockData | SectorEtfData>;
  onSelect: (symbol: string) => void;
  showSector: boolean;
}

function TreemapCell({ tile, onSelect, showSector }: TreemapCellProps) {
  const data = tile.data;
  const width = Math.max(tile.width - GAP, 0);
  const height = Math.max(tile.height - GAP, 0);

  if (width < 6 || height < 6) return null;

  const { fill, edge } = tileTone(data.zScore);

  // Type scales with the tile so a large block reads like a headline and a
  // small one still reads at all.
  //
  // The width term is per-character, not a flat fraction: a four-letter ticker
  // in a narrow tile has to shrink further than a three-letter one, and sizing
  // off the tile alone spills symbols like NBIS and RGTI past their edges. 0.62
  // is the advance width of the tabular numeric face at 1em.
  //
  // The 10 is the tile's own horizontal chrome — px-1 on both sides plus the
  // 1px border — so `usable` is the content box the text actually gets. Reading
  // it as 6 left four-letter tickers a couple of pixels over in the narrowest
  // tiles, which `overflow-hidden` then clipped mid-glyph.
  const base = Math.min(width, height);
  const usable = width - 10;
  const perChar = usable / Math.max(data.symbol.length * 0.62, 1);
  const symbolSize = Math.max(8, Math.min(base * 0.26, perChar, 30));

  // A secondary line is only worth the space if it fits without crowding the
  // symbol above it.
  const sigmaSize = Math.max(9, symbolSize * 0.52);
  const changeSize = Math.max(8, symbolSize * 0.44);
  const priceSize = Math.max(8, symbolSize * 0.42);
  // The sector caption gets its own ramp rather than a fixed 10px: on the ETF
  // map it names the tile, and at 10px "Consumer Staples" was unreadable at a
  // glance. Capped so it never competes with the ticker above it.
  const labelSize = Math.max(11, Math.min(symbolSize * 0.42, 14));

  const showSigma = height >= symbolSize + sigmaSize + 12 && width >= 44;
  const showChange =
    showSigma && height >= symbolSize + sigmaSize + changeSize + 18;
  const showPrice =
    showChange &&
    width >= 52 &&
    height >= symbolSize + sigmaSize + changeSize + priceSize + 24;
  const showLabel = showSector && height >= 96 && width >= 78;

  // A tile too narrow to hold its ticker even at the 8px floor gives up its
  // side padding rather than clipping the glyphs — 8px of gutter is worth less
  // than the last letter of the symbol.
  const tight = perChar < 8;

  return (
    <button
      type="button"
      onClick={() => onSelect(data.symbol)}
      title={`${data.symbol} · ${data.name} · ${formatCurrency(data.price)} · ${formatSigma(data.zScore)} · ${formatPercent(data.changePercent)}`}
      style={{
        ...statusStyle(data.status),
        left: tile.x + GAP / 2,
        top: tile.y + GAP / 2,
        width,
        height,
        backgroundColor: `color-mix(in oklch, var(--state) ${fill}%, transparent)`,
        borderColor: `color-mix(in oklch, var(--state) ${edge}%, transparent)`,
      }}
      className={cn(
        "absolute flex cursor-pointer flex-col items-center justify-center gap-0.5 overflow-hidden rounded-[5px] border text-center",
        tight ? "px-0" : "px-1",
        "transition-[filter,box-shadow] duration-150",
        "hover:z-10 hover:brightness-125 hover:shadow-[0_0_0_1px_var(--state)]",
        "focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
      )}
    >
      <span
        className="num leading-none font-semibold text-foreground"
        style={{ fontSize: symbolSize }}
      >
        {data.symbol}
      </span>

      {showSigma && (
        <span
          className={cn(
            "num leading-none",
            data.status === "NORMAL" ? "text-foreground/70" : "state-tint",
          )}
          style={{ fontSize: sigmaSize }}
        >
          {formatSigma(data.zScore)}
        </span>
      )}

      {showChange && (
        <span
          className={cn(
            "num leading-none",
            data.changePercent > 0
              ? "text-up"
              : data.changePercent < 0
                ? "text-down"
                : "text-muted-foreground",
          )}
          style={{ fontSize: changeSize }}
        >
          {formatPercent(data.changePercent)}
        </span>
      )}

      {showPrice && (
        <span
          className="num leading-none text-foreground/75"
          style={{ fontSize: priceSize }}
        >
          {formatCurrency(data.price)}
        </span>
      )}

      {showLabel && "sectorLabel" in data && (
        // Wraps rather than truncates — "Communication Services" is the tile's
        // name here, and a clipped name is worse than a second line.
        <span
          className="mt-0.5 line-clamp-2 max-w-full leading-tight text-muted-foreground"
          style={{ fontSize: labelSize }}
        >
          {data.sectorLabel}
        </span>
      )}
    </button>
  );
}
