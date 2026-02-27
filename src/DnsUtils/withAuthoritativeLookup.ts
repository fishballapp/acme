import { getIpVersion, getSupportedIpVersions } from "./_helpers.ts";
import { findAuthoritativeNameServerIps } from "./findAuthoritativeNameServerIps.ts";
import type { ResolveDnsFunction } from "./resolveDns.ts";

export type ResolveDnsOptions = {
  /**
   * By default, resolveDns queries the system's recursive DNS resolver (or the specified nameServer).
   *
   * If `authoritative` is true, and the `recordType` is "TXT", `resolveDns` will dynamically
   * search for the authoritative name servers of the given domain, query ALL of them for the TXT record,
   * and return only the records that are propagated across ALL the authoritative name servers.
   */
  authoritative?: boolean;
  nameServer?: { ipAddr: string; port?: number };
};

export const withAuthoritativeLookup = (
  resolveDns: ResolveDnsFunction,
): ResolveDnsFunction => {
  return async <R extends "A" | "AAAA" | "NS" | "TXT">(
    domain: string,
    type: R,
    options?: ResolveDnsOptions,
  ): Promise<"TXT" extends R ? string[][] : string[]> => {
    if (options?.authoritative && type === "TXT") {
      const [nameServerIps, supportedIpVersions] = await Promise.all([
        findAuthoritativeNameServerIps(domain, { resolveDns }),
        getSupportedIpVersions(),
      ]);

      const supportedNameServerIps = nameServerIps.filter((ip) =>
        supportedIpVersions.includes(getIpVersion(ip))
      );

      if (supportedNameServerIps.length === 0) {
        // No supported authoritative name server IPs found. Fall back.
        return resolveDns(domain, type, options);
      }

      // Query all authoritative name servers
      const latestRecordss = await Promise.all(
        supportedNameServerIps.map(async (publicNameserverIp) => {
          try {
            return await resolveDns(domain, "TXT", {
              nameServer: { ipAddr: publicNameserverIp },
            });
          } catch {
            return []; // Treat errors from a single NS as "no records"
          }
        }),
      );

      // Flatten the returned chunks to simplify intersection logic
      const joinedRecordss = latestRecordss.map((records: string[][]) =>
        records.map((chunks) => chunks.join(""))
      );

      // Intersection: find the records present in ALL name server responses
      let commonRecords = joinedRecordss[0] ?? [];
      for (let i = 1; i < joinedRecordss.length; i++) {
        commonRecords = commonRecords.filter((record) =>
          (joinedRecordss[i] ?? []).includes(record)
        );
      }

      // Map back to the expected `string[][]` return type for TXT records
      // deno-lint-ignore no-explicit-any -- TS map generic inference is difficult here
      return commonRecords.map((record) => [record]) as any;
    }

    // Default behavior if not authoritative, or not a TXT query
    return resolveDns(domain, type, options);
  };
};
