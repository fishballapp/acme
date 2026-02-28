/**
 * Node.js resolver implementation with optional authoritative TXT lookup.
 */

import { Resolver } from "node:dns/promises";
import { isIPv4, isIPv6 } from "node:net";
import type { ResolveDnsFunction } from "./DnsUtils/resolveDns.ts";
import { withAuthoritativeLookup } from "./DnsUtils/withAuthoritativeLookup.ts";

type NameServerConfig = {
  ipAddr: string;
  port?: number;
};

export type ResolveDnsNodeOptions = {
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
  options: ResolveDnsNodeOptions = {},
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
    const resolver = new Resolver();
    const configuredNameServer = queryOptions?.nameServer ?? nameServer;
    if (configuredNameServer !== undefined) {
      resolver.setServers([
        ipPort(configuredNameServer.ipAddr, configuredNameServer.port ?? 53),
      ]);
    }

    // deno-lint-ignore no-explicit-any -- TS generic inference for conditional return type is difficult here.
    return (await resolver.resolve(domain, recordType)) as any;
  };

  return withAuthoritativeLookup(baseResolveDns, {
    defaultAuthoritativeForTxt,
  });
};

export const resolveDns: ResolveDnsFunction = createResolveDns();

function ipPort(ip: string, port: number): string {
  if (isIPv4(ip)) return `${ip}:${port}`;
  if (isIPv6(ip)) return `[${ip}]:${port}`;
  throw new Error("Invalid IP address");
}
