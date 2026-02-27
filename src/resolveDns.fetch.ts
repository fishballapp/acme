import type { ResolveDnsFunction } from "./DnsUtils/ResolveDnsFunction.ts";

/**
 * A `resolveDns` implementation that uses Google's DNS-over-HTTPS API.
 * This can be used in the browser or via generic `fetch`.
 */
export const resolveDns: ResolveDnsFunction = async (
  query,
  recordType,
  options,
) => {
  if (options?.nameServer?.ipAddr !== undefined) {
    throw new Error(
      "resolveDns.fetch does not support querying specific authoritative name servers. It can only query via the main DoH endpoint.",
    );
  }

  // Map our internal record types to DNS type values (https://en.wikipedia.org/wiki/List_of_DNS_record_types)
  const dnsTypes: Record<string, number> = {
    "A": 1,
    "NS": 2,
    "TXT": 16,
    "AAAA": 28,
  };

  const typeParam = dnsTypes[recordType];
  if (typeParam === undefined) {
    throw new Error(`Unsupported record type: ${recordType}`);
  }
  const endpoints = [
    "https://cloudflare-dns.com/dns-query",
    "https://dns.google/resolve",
  ];

  let result;
  let lastError: Error | undefined;

  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set("name", query);
      url.searchParams.set("type", typeParam.toString());

      const response = await fetch(url.toString(), {
        headers: {
          "Accept": "application/dns-json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to resolve DNS over HTTPS at ${endpoint}: ${response.statusText}`,
        );
      }

      result = await response.json();
      break; // Successfully fetched
    } catch (e) {
      lastError = e as Error;
      // Continue to next endpoint
    }
  }

  if (!result) {
    throw lastError ?? new Error("Failed to resolve DNS over HTTPS");
  }

  if (!result.Answer) {
    return [];
  }

  // deno-lint-ignore no-explicit-any
  const answers = result.Answer.filter((a: any) => a.type === typeParam).map(
    // deno-lint-ignore no-explicit-any
    (a: any) => a.data,
  );

  if (recordType === "TXT") {
    // TXT records are returned as string strings, often with quotes
    // For consistency with other resolvers, `TXT` should be string[][]
    // deno-lint-ignore no-explicit-any
    return answers.map((data: any) => {
      // Remove surrounding quotes if they exist, which dns.google tends to return
      if (
        typeof data === "string" && data.startsWith('"') && data.endsWith('"')
      ) {
        return [data.slice(1, -1)];
      }
      return [data];
    });
  }

  return answers;
};
