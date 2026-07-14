import type { ResolveDnsFunction } from "../../src/DnsUtils/resolveDns.ts";
import { createResolveDns } from "../../src/resolveDns.doh.ts";
import { PUBLIC_DNS } from "../../src/resolveDns.nameServers.ts";

// CI runners (currently Blacksmith) sit behind their own DNS infrastructure,
// where freshly created TXT records can stay invisible to the system resolver
// for longer than our polling timeout. Resolving over DoH (plain HTTPS)
// bypasses the runner's DNS path entirely, so propagation polling behaves the
// same on any runner.
const ATTEMPT_TIMEOUT_MS = 10_000;

const RESOLVERS = [
  {
    name: "cloudflare",
    resolve: createResolveDns({
      endpoint: PUBLIC_DNS.cloudflare.doh[0],
      timeout: ATTEMPT_TIMEOUT_MS,
    }),
  },
  {
    name: "google",
    resolve: createResolveDns({
      endpoint: PUBLIC_DNS.google.doh[0],
      timeout: ATTEMPT_TIMEOUT_MS,
    }),
  },
];

/**
 * Queries all resolvers in parallel and merges their answers: a record counts
 * as propagated as soon as ANY public resolver sees it. A resolver that got an
 * early NXDOMAIN stuck in its negative cache would otherwise stall polling for
 * the zone's full negative TTL — longer than the polling budget. (The ACME
 * server validates against the zone's authoritative servers anyway, so one
 * resolver seeing the record is a good-enough propagation signal for e2e.)
 */
export const resolveDns: ResolveDnsFunction = async (domain, recordType) => {
  const results = await Promise.allSettled(
    RESOLVERS.map(({ resolve }) => resolve(domain, recordType)),
  );

  const answerss = results.flatMap((result, i) => {
    if (result.status === "rejected") {
      console.warn(
        `⚠️ DoH lookup via ${
          RESOLVERS[i]?.name
        } failed for ${domain} (${recordType}): ${result.reason}`,
      );
      return [];
    }
    return [result.value];
  });

  // All resolvers failed: treat as "record not visible yet" so
  // pollDnsTxtRecord retries (it surfaces thrown errors immediately) — a full
  // DoH outage then shows up as its regular polling timeout with the warnings
  // above in the log, instead of aborting the test.
  // deno-lint-ignore no-explicit-any -- Merged result preserves the resolver contract.
  return answerss.flat() as any;
};
