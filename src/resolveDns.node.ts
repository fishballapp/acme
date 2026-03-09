/**
 * Node.js resolver implementation.
 */

import { Resolver } from "node:dns/promises";
import { isIPv4, isIPv6 } from "node:net";
import type { ResolveDnsFunction } from "./DnsUtils/resolveDns.ts";
export * from "./resolveDns.nameServers.ts";

type NameServerConfig = {
  ipAddr: string;
  port?: number;
};

export type ResolveDnsNodeOptions = {
  /**
   * If provided, all queries use this nameserver by default.
   */
  nameServer?: NameServerConfig;
};

export const createResolveDns = (
  options: ResolveDnsNodeOptions = {},
): ResolveDnsFunction => {
  const { nameServer } = options;

  return async <
    R extends "A" | "AAAA" | "NS" | "TXT",
  >(
    domain: string,
    recordType: R,
  ): Promise<"TXT" extends R ? string[][] : string[]> => {
    const resolver = new Resolver();
    if (nameServer !== undefined) {
      resolver.setServers([
        ipPort(nameServer.ipAddr, nameServer.port ?? 53),
      ]);
    }

    try {
      // deno-lint-ignore no-explicit-any -- TS generic inference for conditional return type is difficult here.
      return (await resolver.resolve(domain, recordType)) as any;
    } catch (error) {
      if (!isNodeDnsRecordNotFoundError(error)) {
        throw error;
      }

      // deno-lint-ignore no-explicit-any -- Empty result preserves the resolver contract.
      return [] as any;
    }
  };
};

export const resolveDns: ResolveDnsFunction = createResolveDns();

function ipPort(ip: string, port: number): string {
  if (isIPv4(ip)) return `${ip}:${port}`;
  if (isIPv6(ip)) return `[${ip}]:${port}`;
  throw new Error("Invalid IP address");
}

const isNodeDnsRecordNotFoundError = (
  error: unknown,
): error is NodeJS.ErrnoException => {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "ENODATA" || error.code === "ENOTFOUND");
};
