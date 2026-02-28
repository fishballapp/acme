import type { ResolveDnsFunction } from "./DnsUtils/resolveDns.ts";
import { withAuthoritativeLookup } from "./DnsUtils/withAuthoritativeLookup.ts";

type NameServerConfig = {
  ipAddr: string;
  port?: number;
};

export type ResolveDnsDenoOptions = {
  /**
   * Whether TXT lookups should use authoritative name server intersection by
   * default.
   *
   * Default: `true`
   */
  defaultAuthoritativeForTxt?: boolean;
  /**
   * If provided, all non-authoritative queries use this nameserver by default.
   */
  nameServer?: NameServerConfig;
};

export const createResolveDns = (
  options: ResolveDnsDenoOptions = {},
): ResolveDnsFunction => {
  const { defaultAuthoritativeForTxt = true, nameServer } = options;

  const baseResolveDns = async <
    R extends "A" | "AAAA" | "NS" | "TXT",
  >(
    domain: string,
    recordType: R,
    queryOptions?: {
      nameServer?: NameServerConfig;
    },
  ): Promise<"TXT" extends R ? string[][] : string[]> => {
    return (await Deno.resolveDns(
      domain,
      recordType,
      (queryOptions?.nameServer ?? nameServer) === undefined
        ? undefined
        : { nameServer: queryOptions?.nameServer ?? nameServer },
    ) as unknown) as "TXT" extends R ? string[][] : string[];
  };

  return withAuthoritativeLookup(baseResolveDns, {
    defaultAuthoritativeForTxt,
  });
};

export const resolveDns: ResolveDnsFunction = createResolveDns();
