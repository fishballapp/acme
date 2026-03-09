import type { ResolveDnsFunction } from "./DnsUtils/resolveDns.ts";
export { PUBLIC_DNS } from "./resolveDns.nameServers.ts";

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
   * - `PUBLIC_DNS.cloudflare.doh[0]`
   * - `PUBLIC_DNS.google.doh[0]`
   * - `PUBLIC_DNS.quad9.doh[0]`
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
      // TXT answers are returned as quoted character-strings in this DoH JSON
      // format. A single TXT record may contain multiple quoted chunks.
      // deno-lint-ignore no-explicit-any -- TS generic inference for conditional return type is difficult here.
      return answers.map((answer) => parseTxtAnswerData(answer.data)) as any;
    }

    // deno-lint-ignore no-explicit-any -- TS generic inference for conditional return type is difficult here.
    return answers.map((answer) => answer.data) as any;
  };
};

const parseTxtAnswerData = (value: string): string[] => {
  return tryParseQuotedTxtChunks(value) ?? [stripWrappingQuotes(value)];
};

const tryParseQuotedTxtChunks = (value: string): string[] | undefined => {
  if (!TXT_QUOTED_CHUNKS_PATTERN.test(value)) {
    return undefined;
  }

  return [...value.matchAll(TXT_QUOTED_CHUNK_PATTERN)].map((match) =>
    decodeTxtChunk(match[1] ?? "")
  );
};

const stripWrappingQuotes = (value: string): string => {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
};

const decodeTxtChunk = (value: string): string => {
  return value.replace(
    TXT_ESCAPE_PATTERN,
    (_match, escape: string) =>
      /^\d{3}$/.test(escape) ? String.fromCharCode(Number(escape)) : escape,
  );
};

const TXT_QUOTED_CHUNKS_PATTERN = /^\s*(?:"(?:\\[0-9]{3}|\\.|[^"\\])*"\s*)+$/;
const TXT_QUOTED_CHUNK_PATTERN = /"((?:\\[0-9]{3}|\\.|[^"\\])*)"/g;
const TXT_ESCAPE_PATTERN = /\\([0-9]{3}|.)/g;
