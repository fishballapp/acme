/**
 * Node.js resolver implementation with optional authoritative TXT lookup.
 */

import { Resolver } from "node:dns/promises";
import { isIPv4, isIPv6 } from "node:net";
import type { ResolveDnsFunction } from "./DnsUtils/resolveDns.ts";
import { withAuthoritativeLookup } from "./DnsUtils/withAuthoritativeLookup.ts";

export type ResolveDnsNodeOptions = {
  /**
   * Whether TXT lookups should use authoritative name server intersection by
   * default. This can still be overridden per call using
   * `options.authoritative`.
   *
   * Default: `true`
   */
  defaultAuthoritativeForTxt?: boolean;
};

const baseResolveDns: ResolveDnsFunction = async (
  domain,
  recordType,
  options,
) => {
  const resolver = new Resolver();
  if (options?.nameServer?.ipAddr !== undefined) {
    resolver.setServers([
      ipPort(options.nameServer.ipAddr, options.nameServer.port ?? 53),
    ]);
  }

  // deno-lint-ignore no-explicit-any -- TS generic inference for conditional return type is difficult here.
  return (await resolver.resolve(domain, recordType)) as any;
};

export const createResolveDns = (
  options: ResolveDnsNodeOptions = {},
): ResolveDnsFunction => {
  const { defaultAuthoritativeForTxt = true } = options;

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
