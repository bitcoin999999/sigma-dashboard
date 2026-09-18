export type ShareResult = "shared" | "cancelled" | "copied" | "manual";
export type ShareInput = { title: string; text: string; url: string };
type ShareNavigator = { share?: (input: ShareInput) => Promise<void>; clipboard?: { writeText: (text: string) => Promise<void> } };
export async function copyLink(url: string, platform: ShareNavigator): Promise<ShareResult> {
  try {
    if (!platform.clipboard) return "manual";
    await platform.clipboard.writeText(url);
    return "copied";
  } catch { return "manual"; }
}
export async function shareLink(input: ShareInput, platform: ShareNavigator): Promise<ShareResult> {
  if (typeof platform.share === "function") {
    try { await platform.share(input); return "shared"; }
    catch (error) {
      if (error && typeof error === "object" && "name" in error && error.name === "AbortError") return "cancelled";
    }
  }
  return copyLink(input.url, platform);
}
