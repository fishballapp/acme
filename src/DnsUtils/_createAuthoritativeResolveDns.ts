import { getIpVersion, getSupportedIpVersions } from "./_helpers.ts";
import { findAuthoritativeNameServerIps } from "./findAuthoritativeNameServerIps.ts";
import type { ResolveDnsFunction } from "./resolveDns.ts";

/**
 * Wraps a base {@link ResolveDnsFunction} with authoritative nameserver checking.
 *
 * For TXT queries (without an explicit `nameServer` option), the returned resolver:
 * 1. Discovers authoritative nameservers for the domain (cached per domain)
 * 2. Queries each authoritative nameserver individually
 * 3. Returns only TXT records found in ALL authoritative nameservers (intersection)
 *
 * For non-TXT queries or queries with an explicit `nameServer`, it passes through
 * to the base resolver unchanged.
 */
export const createAuthoritativeResolveDns = (
  resolveDns: ResolveDnsFunction,
): ResolveDnsFunction => {
  const nsIpCache = new Map<string, Promise<string[]>>();

  const getSupportedNsIps = (domain: string): Promise<string[]> => {
    if (!nsIpCache.has(domain)) {
      nsIpCache.set(
        domain,
        (async () => {
          const nsIps = await findAuthoritativeNameServerIps(domain, {
            resolveDns,
          });
          const supportedVersions = await getSupportedIpVersions();
          return nsIps.filter((ip) =>
            supportedVersions.includes(getIpVersion(ip))
          );
        })(),
      );
    }

    return nsIpCache.get(domain)!;
  };

  // deno-lint-ignore no-explicit-any -- typescript is hard
  return (async (domain: string, recordType: string, options?: any) => {
    if (recordType !== "TXT" || options?.nameServer) {
      return await resolveDns(
        domain,
        // deno-lint-ignore no-explicit-any
        recordType as any,
        options,
      );
    }

    const nsIps = await getSupportedNsIps(domain);

    if (nsIps.length === 0) {
      return await resolveDns(domain, "TXT");
    }

    const allResults = await Promise.all(
      nsIps.map(async (ip) => {
        try {
          return await resolveDns(domain, "TXT", {
            nameServer: { ipAddr: ip },
          });
        } catch {
          return [] as string[][];
        }
      }),
    );

    // Flatten each NS result (join chunks per record)
    const allRecordStrings = allResults.map((records) =>
      records.map((chunks) => chunks.join(""))
    );

    // Intersection: only records present in ALL nameservers
    if (allRecordStrings.length === 0) return [] as string[][];

    const firstSet = allRecordStrings[0]!;
    const intersection = firstSet.filter((record) =>
      allRecordStrings.every((records) => records.includes(record))
    );

    return intersection.map((record) => [record]);
    // deno-lint-ignore no-explicit-any
  }) as any;
};
