import { getIpVersion, getSupportedIpVersions } from "./_helpers.ts";
import { findAuthoritativeNameServerIps } from "./findAuthoritativeNameServerIps.ts";
import type { ResolveDnsFunction } from "./resolveDns.ts";

type ResolveDnsWithNameServerFunction = <
  R extends "A" | "AAAA" | "NS" | "TXT",
>(
  query: string,
  recordType: R,
  options?: {
    nameServer?: {
      ipAddr: string;
      port?: number;
    };
  },
) => Promise<"TXT" extends R ? string[][] : string[]>;

export type WithAuthoritativeLookupOptions = {
  /**
   * If true, TXT lookups query all authoritative name servers and return only
   * records present in all of them.
   */
  defaultAuthoritativeForTxt?: boolean;
};

export const withAuthoritativeLookup = (
  resolveDnsWithNameServer: ResolveDnsWithNameServerFunction,
  options: WithAuthoritativeLookupOptions = {},
): ResolveDnsFunction => {
  const { defaultAuthoritativeForTxt = false } = options;

  return async <R extends "A" | "AAAA" | "NS" | "TXT">(
    domain: string,
    recordType: R,
  ): Promise<"TXT" extends R ? string[][] : string[]> => {
    if (recordType !== "TXT" || !defaultAuthoritativeForTxt) {
      return await resolveDnsWithNameServer(domain, recordType);
    }

    const [nameServerIps, supportedIpVersions] = await Promise.all([
      findAuthoritativeNameServerIps(domain, {
        // We only need the 2-arg shape for NS/A/AAAA discovery.
        resolveDns: resolveDnsWithNameServer as ResolveDnsFunction,
      }),
      getSupportedIpVersions(),
    ]);

    const supportedNameServerIps = nameServerIps.filter((ip) =>
      supportedIpVersions.includes(getIpVersion(ip))
    );

    if (supportedNameServerIps.length <= 0) {
      return await resolveDnsWithNameServer(domain, recordType);
    }

    const allRecordss = await Promise.all(
      supportedNameServerIps.map(async (publicNameServerIp) => {
        try {
          return await resolveDnsWithNameServer(domain, "TXT", {
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
