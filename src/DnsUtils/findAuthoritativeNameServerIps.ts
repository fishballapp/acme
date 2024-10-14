import { defaultResolveDns, type ResolveDnsFunction } from "./resolveDns.ts";
export type FindAuthoritativeNameServerIpsConfig = {
  /**
   * A function to resolve DNS record.
   *
   * {@link findAuthoritativeNameServerIps} performs lookup on 3 record types:
   * - `NS`: Used to find out the authoritative name servers of your domain.
   *   - Expected return type `Promise<string[]>`
   * - `A`: Used to find out the IPv4 addresses of your authoritative name servers.
   *   - Expected return type `Promise<string[]>`
   * - `AAAA`: Used to find out the IPv6 addresses of your authoritative name servers.
   *   - Expected return type `Promise<string[]>`
   *
   * You should provide an implementation of {@link ResolveDnsFunction} that can resolve those records type correctly.
   */
  resolveDns?: ResolveDnsFunction;
};

/**
 * A function to lookup the IPv4 (`A` records) and IPv6 (`AAAA` records)
 * for the authoritative name servers (`NS` records) of a given {@link domain}.
 */
export const findAuthoritativeNameServerIps = async (
  domain: string,
  config: FindAuthoritativeNameServerIpsConfig = {},
): Promise<string[]> => {
  const { resolveDns = defaultResolveDns } = config;
  while (domain.includes(".")) { // continue the loop if we haven't reached TLD
    const nameServers = await (async () => {
      try {
        return await resolveDns(domain, "NS");
      } catch {
        return null;
      }
    })();

    if (nameServers === null) {
      domain = domain.slice(domain.indexOf(".") + 1);
      continue;
    }

    const ips = (await Promise.all(
      [
        ...nameServers.map(async (ns) => {
          try {
            return await resolveDns(ns, "A");
          } catch {
            return [];
          }
        }),
        ...nameServers.map(async (ns) => {
          try {
            return await resolveDns(ns, "AAAA");
          } catch {
            return [];
          }
        }),
      ],
    )).flat();

    return [...new Set(ips)];
  }

  return [];
};
