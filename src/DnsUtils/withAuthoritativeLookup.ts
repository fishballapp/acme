import { getIpVersion, getSupportedIpVersions } from "./_helpers.ts";
import { findAuthoritativeNameServerIps } from "./findAuthoritativeNameServerIps.ts";
import type { ResolveDnsFunction } from "./resolveDns.ts";

export type WithAuthoritativeLookupOptions = {
  /**
   * If true, TXT lookups default to authoritative lookup mode unless
   * explicitly overridden by the call-level `options.authoritative`.
   */
  defaultAuthoritativeForTxt?: boolean;
};

export const withAuthoritativeLookup = (
  resolveDns: ResolveDnsFunction,
  options: WithAuthoritativeLookupOptions = {},
): ResolveDnsFunction => {
  const { defaultAuthoritativeForTxt = false } = options;

  return async <R extends "A" | "AAAA" | "NS" | "TXT">(
    domain: string,
    recordType: R,
    queryOptions?: Parameters<ResolveDnsFunction>[2],
  ): Promise<"TXT" extends R ? string[][] : string[]> => {
    const useAuthoritativeLookup = recordType === "TXT" &&
      (queryOptions?.authoritative ?? defaultAuthoritativeForTxt);

    if (!useAuthoritativeLookup) {
      return await resolveDns(domain, recordType, queryOptions);
    }

    const [nameServerIps, supportedIpVersions] = await Promise.all([
      findAuthoritativeNameServerIps(domain, { resolveDns }),
      getSupportedIpVersions(),
    ]);

    const supportedNameServerIps = nameServerIps.filter((ip) =>
      supportedIpVersions.includes(getIpVersion(ip))
    );

    if (supportedNameServerIps.length <= 0) {
      return await resolveDns(domain, recordType, queryOptions);
    }

    const allRecordss = await Promise.all(
      supportedNameServerIps.map(async (publicNameServerIp) => {
        try {
          return await resolveDns(domain, "TXT", {
            nameServer: { ipAddr: publicNameServerIp },
          });
        } catch {
          return [];
        }
      }),
    );

    const allJoinedRecordss = allRecordss.map((records) =>
      records.map((chunks) => chunks.join(""))
    );

    let commonRecords = allJoinedRecordss[0] ?? [];
    for (let i = 1; i < allJoinedRecordss.length; i++) {
      commonRecords = commonRecords.filter((record) =>
        allJoinedRecordss[i]?.includes(record)
      );
    }

    // deno-lint-ignore no-explicit-any -- TS generic inference for conditional return type is difficult here.
    return commonRecords.map((record) => [record]) as any;
  };
};
