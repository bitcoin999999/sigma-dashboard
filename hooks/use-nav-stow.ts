"use client";

import { useEffect, useState } from "react";

/**
 * Whether a pinned bar should step out of the way.
 *
 * Reading down the board is the one thing this page is for, and the bars sit on
 * top of it the whole way. They step aside while you go down and come back the
 * moment you go up, which is also when you are looking for them.
 *
 * `hold` is for the states where the bar is the thing being used rather than
 * the thing in the way — a menu open inside it, a field focused in it — and the
 * keyboard's own scrolling would otherwise slide it out from under the user.
 */
export function useNavStow(hold = false) {
  const [stowed, setStowed] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      // Below this the movement is a thumb resting on the glass, not a scroll.
      if (Math.abs(y - last) < 8) return;
      // Never stowed near the top: there the bar is the only navigation on screen.
      setStowed(y > last && y > 96);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return stowed && !hold;
}
