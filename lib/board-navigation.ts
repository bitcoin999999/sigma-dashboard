"use client";

/** Preserve the board's scroll position before a client-side detail jump. */
export function rememberBoardScroll() {
  if (location.pathname !== "/") return;
  history.replaceState({ ...history.state, sigmaBoardScroll: window.scrollY }, "");
}
