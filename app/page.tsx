import { Dashboard } from "@/components/dashboard/dashboard";
import { loadSnapshot } from "@/lib/snapshot";

/** The snapshot file is rewritten out of band by the daily job, so never cache it. */
export const dynamic = "force-dynamic";

export default async function Home() {
  const { quotes, sectorQuotes, snapshot } = await loadSnapshot();

  return (
    <Dashboard quotes={quotes} sectorQuotes={sectorQuotes} snapshot={snapshot} />
  );
}
