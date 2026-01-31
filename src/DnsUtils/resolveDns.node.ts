/**
 * Node.js implementation of `resolveDns`.
 *
 * This file will be used in Node.js. Thanks to DNT's build mapping. See more in `scripts/build-npm.ts`.
 */

import { Resolver } from "node:dns/promises";
import { isIPv4, isIPv6 } from "node:net";
import type { ResolveDnsFunction } from "./resolveDns.ts";

export const resolveDns: ResolveDnsFunction = async (
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

  // deno-lint-ignore no-explicit-any -- Resolver.resolve returns a wide type that we know narrows correctly based on recordType, but TS inference struggles.
  return (await resolver.resolve(domain, recordType)) as any;
};

function ipPort(ip: string, port: number): string {
  if (isIPv4(ip)) return `${ip}:${port}`;
  if (isIPv6(ip)) return `[${ip}]:${port}`;
  throw new Error("Invalid IP address");
}
