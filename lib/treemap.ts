/**
 * Squarified treemap layout (Bruls, Huizing & van Wijk, 2000).
 *
 * Kept free of React and of anything σ-specific so the packing can be reasoned
 * about — and corrected — on its own. The component decides what a weight
 * *means*; this file only turns weights into rectangles.
 *
 * The naive "slice and dice" layout degenerates into slivers as soon as one
 * weight dominates, and a sliver is unreadable no matter how it is styled.
 * Squarifying greedily grows a row only while doing so improves the worst
 * aspect ratio in that row, which is what gives the Finviz look its legibility.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TreemapItem<T> {
  key: string;
  /** Relative area. Non-positive weights are dropped, not clamped. */
  weight: number;
  data: T;
}

export interface TreemapTile<T> extends Rect {
  key: string;
  data: T;
}

/**
 * Worst (largest) aspect ratio in a row, given the side it is laid against.
 *
 * Row weights are in weight units; `scale` converts them to area. Returns
 * Infinity for an empty or zero-area row so that the caller's `<=` comparison
 * always accepts the first item.
 */
function worstAspect(
  rowWeights: number[],
  side: number,
  scale: number,
): number {
  if (rowWeights.length === 0 || side <= 0) return Infinity;

  let sum = 0;
  let max = -Infinity;
  let min = Infinity;
  for (const weight of rowWeights) {
    sum += weight;
    if (weight > max) max = weight;
    if (weight < min) min = weight;
  }

  const area = sum * scale;
  if (area <= 0 || min <= 0) return Infinity;

  const maxArea = max * scale;
  const minArea = min * scale;
  const sideSq = side * side;
  const areaSq = area * area;

  return Math.max((sideSq * maxArea) / areaSq, areaSq / (sideSq * minArea));
}

/**
 * Packs `items` into `rect`, largest first.
 *
 * Total tile area equals the rect's area exactly (up to float error), so the
 * caller can read any tile's size as a faithful share of the whole.
 */
export function squarify<T>(
  items: TreemapItem<T>[],
  rect: Rect,
): TreemapTile<T>[] {
  const tiles: TreemapTile<T>[] = [];

  const sorted = items
    .filter((item) => item.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key));

  if (sorted.length === 0 || rect.width <= 0 || rect.height <= 0) return tiles;

  const total = sorted.reduce((sum, item) => sum + item.weight, 0);
  const scale = (rect.width * rect.height) / total;

  let { x, y, width, height } = rect;
  let cursor = 0;

  while (cursor < sorted.length && width > 0 && height > 0) {
    const side = Math.min(width, height);

    // Grow the row while the worst aspect ratio keeps improving. The moment
    // adding an item makes the row squatter, that row is done.
    const row: TreemapItem<T>[] = [];
    const rowWeights: number[] = [];

    while (cursor < sorted.length) {
      const candidate = sorted[cursor];
      const next = [...rowWeights, candidate.weight];
      if (
        row.length === 0 ||
        worstAspect(next, side, scale) <= worstAspect(rowWeights, side, scale)
      ) {
        row.push(candidate);
        rowWeights.push(candidate.weight);
        cursor += 1;
      } else {
        break;
      }
    }

    const rowArea = rowWeights.reduce((sum, weight) => sum + weight, 0) * scale;

    if (width >= height) {
      // Lay the row down the left edge as a vertical strip.
      const stripWidth = Math.min(rowArea / height, width);
      let offset = y;

      row.forEach((item, index) => {
        const isLast = index === row.length - 1;
        const tileHeight = isLast
          ? // Absorb float drift into the last tile so the strip closes flush.
            y + height - offset
          : (item.weight * scale) / stripWidth;

        tiles.push({
          key: item.key,
          data: item.data,
          x,
          y: offset,
          width: stripWidth,
          height: tileHeight,
        });
        offset += tileHeight;
      });

      x += stripWidth;
      width -= stripWidth;
    } else {
      const stripHeight = Math.min(rowArea / width, height);
      let offset = x;

      row.forEach((item, index) => {
        const isLast = index === row.length - 1;
        const tileWidth = isLast
          ? x + width - offset
          : (item.weight * scale) / stripHeight;

        tiles.push({
          key: item.key,
          data: item.data,
          x: offset,
          y,
          width: tileWidth,
          height: stripHeight,
        });
        offset += tileWidth;
      });

      y += stripHeight;
      height -= stripHeight;
    }
  }

  return tiles;
}

/** Shrinks a rect on every side. Never returns a negative dimension. */
export function inset(rect: Rect, top: number, side = top): Rect {
  return {
    x: rect.x + side,
    y: rect.y + top,
    width: Math.max(rect.width - side * 2, 0),
    height: Math.max(rect.height - top - side, 0),
  };
}
