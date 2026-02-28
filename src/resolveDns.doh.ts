import type { ResolveDnsFunction } from "./DnsUtils/resolveDns.ts";
export { DOH_ENDPOINTS } from "./resolveDns.nameServers.ts";

/**
 * DNS-over-HTTPS resolver endpoints that work with this implementation.
 *
 * This resolver can be used in any runtime that supports `fetch`, including:
 * - Browsers
 * - Deno
 * - Node.js (with a fetch-enabled runtime)
 * - Edge runtimes / workers
 */
export type ResolveDnsDohOptions = {
  /**
   * DNS-over-HTTPS JSON endpoint.
   *
   * Choose one of:
   * - `DOH_ENDPOINTS.cloudflare`
   * - `DOH_ENDPOINTS.google`
   * or provide your own compatible endpoint.
   */
  endpoint: string;
};

type DnsRecordType = "A" | "AAAA" | "NS" | "TXT";

const DNS_TYPE_NUMBERS: Record<DnsRecordType, number> = {
  A: 1,
  NS: 2,
  TXT: 16,
  AAAA: 28,
};

type DnsJsonAnswer = {
  type: number;
  data: string;
};

type DnsJsonResponse = {
  Status?: number;
  Answer?: DnsJsonAnswer[];
};

/**
 * A DNS resolver that uses DNS-over-HTTPS (DoH) via `fetch`.
 *
 * This implementation is runtime-agnostic and works in any environment where
 * `fetch` is available, including browsers.
 */
export const createResolveDns = (
  options: ResolveDnsDohOptions,
): ResolveDnsFunction => {
  const { endpoint } = options;

  return async (domain, recordType) => {
    const url = new URL(endpoint);
    url.searchParams.set("name", domain);
    url.searchParams.set("type", recordType);

    const res = await fetch(url, {
      headers: {
        Accept: "application/dns-json",
      },
    });

    if (!res.ok) {
      throw new Error(
        `Failed to resolve DNS for ${domain} (${recordType}): ${res.status} ${res.statusText}`,
      );
    }

    const body: DnsJsonResponse = await res.json();
    if (body.Status !== 0) {
      // For statuses like NXDOMAIN(3), SERVFAIL(2), etc., treat as no records.
      // deno-lint-ignore no-explicit-any -- TS generic inference for conditional return type is difficult here.
      return [] as any;
    }

    const answers = (body.Answer ?? []).filter((answer) =>
      answer.type === DNS_TYPE_NUMBERS[recordType]
    );

    if (recordType === "TXT") {
      // TXT answers are returned as quoted strings in this DoH JSON format.
      // deno-lint-ignore no-explicit-any -- TS generic inference for conditional return type is difficult here.
      return answers.map((answer) => [stripWrappingQuotes(answer.data)]) as any;
    }

    // deno-lint-ignore no-explicit-any -- TS generic inference for conditional return type is difficult here.
    return answers.map((answer) => answer.data) as any;
  };
};

const stripWrappingQuotes = (value: string): string => {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
};
