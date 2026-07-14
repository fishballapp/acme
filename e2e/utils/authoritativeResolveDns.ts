// deno-lint-ignore no-unused-vars -- imported for jsdoc
import type { DnsUtils } from "../../src/mod.ts";

import {
  createUnanimousResolveDns,
  type ResolveDnsFunction,
} from "../../src/DnsUtils/mod.ts";
import { createResolveDns, resolveDns } from "../../src/resolveDns.deno.ts";

/**
 * Find the authoritative nameserver hostnames for `domain` by walking up its
 * labels until a level answers with `NS` records (the zone cut).
 */
const resolveZoneNameServers = async (domain: string): Promise<string[]> => {
  const labels = domain.replace(/\.$/, "").split(".");

  // Stop before the TLD; a registrable zone always has at least two labels.
  for (let i = 0; i < labels.length - 1; i++) {
    const candidate = labels.slice(i).join(".");
    const nameServers = await resolveDns(candidate, "NS");
    if (nameServers.length > 0) return nameServers;
  }

  throw new Error(`Could not find authoritative nameservers for "${domain}"`);
};

/**
 * Build a resolver that queries the authoritative nameservers of `domain`'s
 * zone directly, instead of going through a recursive/caching resolver.
 *
 * DNS-01 self-checks (see {@link DnsUtils.pollDnsTxtRecord}) poll for a `TXT`
 * record right after creating it. A recursive resolver (e.g. `1.1.1.1`) caches
 * the "not found" answer it gets before the record has propagated for the
 * zone's negative-cache TTL (the SOA minimum, e.g. 1800s for `fishball.dev`).
 * That TTL outlives the poll timeout, so once a negative answer is cached the
 * poll can never observe the record and eventually times out — the source of
 * the flaky E2E failures.
 *
 * Authoritative servers do not cache, so they always reflect the current
 * record. Requiring all of them to agree (via
 * {@link createUnanimousResolveDns}) additionally guarantees the record is
 * fully propagated before we ask the CA to validate it.
 */
export const createAuthoritativeResolveDns = async (
  domain: string,
): Promise<ResolveDnsFunction> => {
  const nameServers = await resolveZoneNameServers(domain);

  const ipAddrs = [
    ...new Set(
      (await Promise.all(
        nameServers.map((nameServer) => resolveDns(nameServer, "A")),
      )).flat(),
    ),
  ];

  if (ipAddrs.length === 0) {
    throw new Error(
      `Could not resolve any authoritative nameserver IP for "${domain}"`,
    );
  }

  return createUnanimousResolveDns(
    ipAddrs.map((ipAddr) => createResolveDns({ nameServer: { ipAddr } })),
  );
};
