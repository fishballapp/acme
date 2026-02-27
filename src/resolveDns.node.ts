import { Resolver } from "node:dns/promises";
import { isIPv4, isIPv6 } from "node:net";
import type { ResolveDnsFunction } from "./DnsUtils/resolveDns.ts";
import { withAuthoritativeLookup } from "./DnsUtils/withAuthoritativeLookup.ts";

function ipPort(ip: string, port: number): string {
  if (isIPv4(ip)) return `${ip}:${port}`;
  if (isIPv6(ip)) return `[${ip}]:${port}`;
  throw new Error("Invalid IP address");
}

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

  // deno-lint-ignore no-explicit-any -- typescript is hard
  return (await resolver.resolve(domain, recordType)) as any;
};

// Node.js's native `dns/promises` wrapped with authoritative lookup support
export const resolveDns = withAuthoritativeLookup(baseResolveDns);
