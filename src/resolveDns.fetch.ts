import type { ResolveDnsFunction } from "./DnsUtils/resolveDns.ts";

export type ResolveDnsFetchOptions = {
  /**
   * By default Cloudflare DNS (`https://cloudflare-dns.com/dns-query`) is used.
   * You can override this by providing a custom DoH JSON endpoint.
   */
  endpoint?: string;
};

/**
 * A DNS resolver that uses DNS over HTTPS (DoH) via the `fetch` API.
 * This is useful for environments like edge workers or browsers where native DNS resolution is not available.
 *
 * Note: DoH resolvers do not support targeting specific authoritative name servers via IP.
 * The `nameServer` option from `ResolveDnsFunction` will be ignored.
 */
export const createResolveDns = (
  options?: ResolveDnsFetchOptions,
): ResolveDnsFunction => {
  const endpoint = options?.endpoint ?? "https://cloudflare-dns.com/dns-query";

  return async (domain, type, _queryOptions) => {
    // We ignore `queryOptions?.nameServer` because DoH acts as a recursive resolver
    // and doesn't support targeting specific IPs for the query.

    const url = new URL(endpoint);
    url.searchParams.set("name", domain);
    url.searchParams.set("type", type);

    const res = await fetch(url, {
      headers: {
        "Accept": "application/dns-json",
      },
    });

    if (!res.ok) {
      throw new Error(
        `Failed to resolve DNS for ${domain} (${type}): ${res.statusText}`,
      );
    }

    const json = await res.json();

    // Status 0 means NOERROR. Status 3 means NXDOMAIN.
    if (json.Status !== 0) {
      // If NXDOMAIN (3) or no answer, we just return empty
      return [];
    }

    const answers = json.Answer ?? [];

    if (type === "TXT") {
      // TXT records are returned as strings, often quoted.
      // E.g., "\"v=spf1 ...\"" -> [["v=spf1 ..."]]
      return answers.map((a: unknown) => {
        let text = (a as { data: string }).data;
        if (text.startsWith('"') && text.endsWith('"')) {
          text = text.slice(1, -1);
        }
        return [text]; // return as chunks
      });
    }

    return answers.map((a: { data: string }) => a.data) as any;
  };
};

// Default export if you just want to use the default settings
export const resolveDns = createResolveDns();
