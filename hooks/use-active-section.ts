"use client";

import * as React from "react";

/** Tracks which anchored section owns the middle of the viewport. */
export function useActiveSection(ids: string[]): string {
  const [active, setActive] = React.useState(ids[0] ?? "");
  const key = ids.join(",");

  React.useEffect(() => {
    const sectionIds = key.split(",").filter(Boolean);
    const visible = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let best = "";
        let bestRatio = 0;
        for (const id of sectionIds) {
          const ratio = visible.get(id) ?? 0;
          if (ratio > bestRatio) {
            best = id;
            bestRatio = ratio;
          }
        }
        if (best) setActive(best);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );

    for (const id of sectionIds) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, [key]);

  return active;
}
