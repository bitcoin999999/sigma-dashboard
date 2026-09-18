/** Only an unmodified primary click on desktop opens the existing panel. */
export function opensPanel(event: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }, desktop: boolean) {
  return desktop && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
