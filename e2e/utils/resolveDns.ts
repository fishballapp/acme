import { createResolveDns, PUBLIC_DNS } from "@fishballpkg/acme/resolveDns.doh";
import type { ResolveDnsFunction } from "@fishballpkg/acme/DnsUtils";

/**
 * E2E resolver used to poll for challenge TXT records.
 *
 * Two things are going on here:
 *
 * 1. **DoH instead of `Deno.resolveDns`.** E2E runs on Blacksmith's Firecracker
 *    microVMs, whose local resolver can't answer the external TXT queries
 *    `Deno.resolveDns` issues directly over UDP/53. DoH resolves over HTTPS —
 *    the same path `fetch` already uses successfully here.
 *
 * 2. **Rotating across public resolvers.** A recursive resolver that is asked
 *    for the freshly-created `_acme-challenge` record *before* it has
 *    propagated caches the `NXDOMAIN` for the zone's SOA negative-TTL
 *    (`fishball.dev` = 1800s), which is far longer than the 10-minute poll — so
 *    a single early miss would otherwise poison the whole run. Rotating means a
 *    negative cached at one resolver on an early attempt can't sink the poll:
 *    the next attempt hits a different resolver whose first lookup lands after
 *    propagation. {@link waitForDnsPropagation} additionally holds off the very
 *    first query until the record is live, so ideally no negative is ever
 *    cached.
 *
 *    Only Cloudflare and Google are used: they implement the DoH JSON API this
 *    resolver speaks. Quad9's `/dns-query` answers `application/dns-json` with
 *    `400`, which would throw and — since {@link pollDnsTxtRecord} surfaces
 *    thrown errors immediately — fail the poll rather than retry.
 */
const resolvers: readonly ResolveDnsFunction[] = [
  createResolveDns({ endpoint: PUBLIC_DNS.cloudflare.doh[0] }),
  createResolveDns({ endpoint: PUBLIC_DNS.google.doh[0] }),
];

let attempt = 0;
export const resolveDns: ResolveDnsFunction = (query, recordType) => {
  const resolver = resolvers[attempt % resolvers.length]!;
  attempt++;
  return resolver(query, recordType);
};

/**
 * Delay (ms) to let a just-created record reach the public recursive resolvers
 * before the first lookup. Comfortably exceeds Cloudflare's API→resolver
 * propagation (seconds) while staying well under the 10-minute poll budget.
 */
const DNS_PROPAGATION_DELAY = 30_000;

/**
 * Wait for a just-created record to propagate before the first DNS lookup, so
 * the poll never caches a negative answer (see {@link resolveDns}).
 */
export const waitForDnsPropagation = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, DNS_PROPAGATION_DELAY));
