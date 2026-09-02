/**
 * Intraday prices for the leverage calculator.
 *
 * The rest of the site runs off the daily snapshot, which is settled closes and
 * nothing else. The calculator cannot: converting a level on the QQQ chart into
 * a TQQQ price is only right if both legs are read at the same moment, and a
 * close from last night is not that moment. So this is a second, deliberately
 * separate feed — it never touches the snapshot and no σ figure is derived from
 * it.
 */

const SPARK_URL = "https://query1.finance.yahoo.com/v8/finance/spark";

/** The endpoint answers 400 above twenty symbols, so requests are batched. */
const BATCH_LIMIT = 20;

const TIMEOUT_MS = 8_000;

/**
 * How long one upstream read is reused. Long enough that a burst of visitors is
 * one request, short enough that a price on screen is never a minute stale.
 */
const TTL_MS = 60_000;

/**
 * Sent because the endpoint answers 429 to a request with no agent at all.
 * Names the caller honestly rather than impersonating a browser.
 */
const USER_AGENT = "1SIGMA/1.0 (+https://sigma-dashboard-five.vercel.app)";

export interface LiveQuote {
  symbol: string;
  price: number;
  previousClose: number;
  /** Move since the previous close, in percent. */
  changePercent: number;
}

export interface LiveQuotes {
  quotes: Record<string, LiveQuote>;
  /** When the feed last printed, as an ISO instant. */
  asOf: string;
}

interface SparkEntry {
  close?: (number | null)[];
  chartPreviousClose?: number;
  timestamp?: number[];
}

function isPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** The last printed price in the series, or nothing if the series is empty. */
function lastClose(entry: SparkEntry): number | null {
  const closes = Array.isArray(entry.close) ? entry.close : [];
  for (let i = closes.length - 1; i >= 0; i -= 1) {
    if (isPrice(closes[i])) return closes[i] as number;
  }
  return null;
}

async function loadBatch(
  symbols: string[],
): Promise<{ entries: Record<string, SparkEntry>; latest: number }> {
  const url = `${SPARK_URL}?symbols=${symbols.join(",")}&range=1d&interval=1d`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      // The page that renders this is force-dynamic, which turns off fetch
      // caching for everything under it. The TTL below is what absorbs load.
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    throw new Error("Quote feed did not answer.", { cause });
  }

  if (!response.ok) {
    throw new Error(`Quote feed returned ${response.status}.`);
  }

  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null) {
    throw new Error("Quote feed did not return an object.");
  }

  // Failures come back wrapped in a `spark` envelope; successes are a flat map
  // keyed by symbol. Anything wrapped is an error, whatever the status code.
  if ("spark" in body) {
    const error = (body as { spark?: { error?: { description?: string } } })
      .spark?.error;
    throw new Error(`Quote feed rejected the request: ${error?.description}`);
  }

  const entries = body as Record<string, SparkEntry>;
  let latest = 0;

  for (const entry of Object.values(entries)) {
    for (const stamp of entry?.timestamp ?? []) {
      if (typeof stamp === "number" && stamp > latest) latest = stamp;
    }
  }

  return { entries, latest };
}

function chunk(symbols: string[], size: number): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < symbols.length; i += size) {
    batches.push(symbols.slice(i, i + size));
  }
  return batches;
}

async function fetchQuotes(symbols: string[]): Promise<LiveQuotes> {
  const batches = await Promise.all(
    chunk(symbols, BATCH_LIMIT).map((batch) => loadBatch(batch)),
  );

  const quotes: Record<string, LiveQuote> = {};
  let latest = 0;

  for (const batch of batches) {
    latest = Math.max(latest, batch.latest);

    for (const symbol of Object.keys(batch.entries)) {
      const entry = batch.entries[symbol];
      const previousClose = entry?.chartPreviousClose;
      // Before the open the series is empty, and the previous close is the only
      // price there is — which is also the right reference at that hour.
      const price = lastClose(entry) ?? previousClose;

      if (!isPrice(price) || !isPrice(previousClose)) continue;

      quotes[symbol] = {
        symbol,
        price,
        previousClose,
        changePercent: (price / previousClose - 1) * 100,
      };
    }
  }

  if (Object.keys(quotes).length === 0) {
    throw new Error("Quote feed returned no usable prices.");
  }

  return {
    quotes,
    asOf: new Date(latest > 0 ? latest * 1000 : Date.now()).toISOString(),
  };
}

let memo: { key: string; at: number; quotes: LiveQuotes } | null = null;

/**
 * Live prices for `symbols`, shared across requests for {@link TTL_MS}.
 *
 * Memoised in module scope rather than through the framework cache because the
 * calculator route is force-dynamic, which disables that cache outright. A warm
 * serverless instance therefore makes one upstream call a minute no matter how
 * many visitors it serves; a cold one pays for its own.
 */
export async function loadLiveQuotes(symbols: string[]): Promise<LiveQuotes> {
  const key = symbols.join(",");
  if (memo && memo.key === key && Date.now() - memo.at < TTL_MS) {
    return memo.quotes;
  }

  const quotes = await fetchQuotes(symbols);
  memo = { key, at: Date.now(), quotes };
  return quotes;
}
