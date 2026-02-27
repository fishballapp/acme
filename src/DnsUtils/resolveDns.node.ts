/**
 * Node.js implementation of `resolveDns`.
 */

import { Resolver } from "node:dns/promises";
import { isIPv4, isIPv6 } from "node:net";
import { createAuthoritativeResolveDns } from "./_createAuthoritativeResolveDns.ts";
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

  // deno-lint-ignore no-explicit-any -- typescript is hard
  return (await resolver.resolve(domain, recordType)) as any;
};

export type CreateResolveDnsOptions = {
  /**
   * When `true`, lookups will query all authoritative nameservers
   * individually and only return records present in ALL of them.
   *
   * This is useful for verifying DNS propagation during ACME DNS-01 challenges.
   *
   * Default: `false`
   */
  queryAuthoritativeNameServers?: boolean;
};

export const createResolveDns = (
  options: CreateResolveDnsOptions = {},
): ResolveDnsFunction => {
  if (options.queryAuthoritativeNameServers) {
    return createAuthoritativeResolveDns(resolveDns);
  }
  return resolveDns;
};

function ipPort(ip: string, port: number): string {
  if (isIPv4(ip)) return `${ip}:${port}`;
  if (isIPv6(ip)) return `[${ip}]:${port}`;
  throw new Error("Invalid IP address");
}
