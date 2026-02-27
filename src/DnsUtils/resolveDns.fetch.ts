/**
 * DNS-over-HTTPS (DoH) implementation of `resolveDns` using the `fetch` API.
 *
 * Works on any platform that supports `fetch` (Deno, Node.js, browsers, etc.).
 *
 * Uses the JSON DNS API format. The `nameServer` option is ignored as
 * DoH always resolves through its configured resolver service.
 */

import type { ResolveDnsFunction } from "./resolveDns.ts";

const DNS_RECORD_TYPE_CODES = {
  A: 1,
  AAAA: 28,
  NS: 2,
  TXT: 16,
} as const;

export type CreateResolveDnsOptions = {
  /**
   * The DoH endpoint URL.
   *
   * Default: `"https://dns.google/resolve"`
   */
  url?: string;
};

export const createResolveDns = (
  options: CreateResolveDnsOptions = {},
): ResolveDnsFunction => {
  const dohUrl = options.url ?? "https://dns.google/resolve";

  // deno-lint-ignore no-explicit-any -- typescript is hard
  return (async (query: string, recordType: string, _options?: any) => {
    const url = new URL(dohUrl);
    url.searchParams.set("name", query);
    url.searchParams.set("type", recordType);

    const response = await fetch(url, {
      headers: { Accept: "application/dns-json" },
    });

    if (!response.ok) {
      throw new Error(
        `DoH query failed: ${response.status} ${response.statusText}`,
      );
    }

    const data: {
      Answer?: { type: number; data: string }[];
    } = await response.json();

    if (!data.Answer || data.Answer.length === 0) {
      throw new Error(`No ${recordType} records found for ${query}`);
    }

    const typeCode =
      DNS_RECORD_TYPE_CODES[recordType as keyof typeof DNS_RECORD_TYPE_CODES];

    const filtered = data.Answer.filter((a) => a.type === typeCode);

    if (recordType === "TXT") {
      return filtered.map((a) => [stripQuotes(a.data)]);
    }

    return filtered.map((a) =>
      recordType === "NS" ? a.data.replace(/\.$/, "") : a.data
    );
    // deno-lint-ignore no-explicit-any
  }) as any;
};

/**
 * Pre-configured DoH resolver using Google DNS (`https://dns.google/resolve`).
 */
export const resolveDns: ResolveDnsFunction = createResolveDns();

function stripQuotes(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1);
  }
  return s;
}
