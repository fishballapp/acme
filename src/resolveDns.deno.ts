import type { ResolveDnsFunction } from "./DnsUtils/resolveDns.ts";
export * from "./resolveDns.nameServers.ts";

type NameServerConfig = {
  ipAddr: string;
  port?: number;
};

export type ResolveDnsDenoOptions = {
  /**
   * If provided, all queries use this nameserver by default.
   */
  nameServer?: NameServerConfig;
};

export const createResolveDns = (
  options: ResolveDnsDenoOptions = {},
): ResolveDnsFunction => {
  const { nameServer } = options;

  return async <
    R extends "A" | "AAAA" | "NS" | "TXT",
  >(
    domain: string,
    recordType: R,
  ): Promise<"TXT" extends R ? string[][] : string[]> => {
    return (await Deno.resolveDns(
      domain,
      recordType,
      nameServer === undefined ? undefined : { nameServer },
    ) as unknown) as "TXT" extends R ? string[][] : string[];
  };
};

export const resolveDns: ResolveDnsFunction = createResolveDns();
