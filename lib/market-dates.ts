/** The scheduled Friday ending the forward week, including Thursday anchors on holidays. */
export function bandEndDate(anchor: string): string {
  const date = new Date(`${anchor}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  monday.setUTCDate(monday.getUTCDate() + 11);
  return monday.toISOString().slice(0, 10);
}

export function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
