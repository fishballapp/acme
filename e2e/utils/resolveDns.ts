import type { ResolveDnsFunction } from "../../src/DnsUtils/resolveDns.ts";
import { createResolveDns } from "../../src/resolveDns.doh.ts";
import { PUBLIC_DNS } from "../../src/resolveDns.nameServers.ts";

// CI runners (currently Blacksmith) sit behind their own DNS infrastructure,
// where freshly created TXT records can stay invisible to the system resolver
// for longer than our polling timeout. Resolving over DoH (plain HTTPS)
// bypasses the runner's DNS path entirely, so propagation polling behaves the
// same on any runner.
const ATTEMPT_TIMEOUT_MS = 10_000;

const dohResolveDns = createResolveDns({
  endpoint: PUBLIC_DNS.cloudflare.doh[0],
  timeout: ATTEMPT_TIMEOUT_MS,
});

/**
 * Flushes a record from 1.1.1.1's cache via the endpoint behind
 * https://one.one.one.one/purge-cache/.
 *
 * Unofficial and undocumented — Cloudflare may gate or change it without
 * notice. If e2e starts timing out on DNS polling with purge warnings in the
 * log, this endpoint is the first thing to check.
 */
const purgeCloudflareDnsCache = async (
  domain: string,
  recordType: string,
): Promise<void> => {
  const url = new URL("https://one.one.one.one/api/v1/purge");
  url.searchParams.set("domain", domain.replace(/\.$/, ""));
  url.searchParams.set("type", recordType);

  const res = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
  });
  await res.text(); // consume the body to avoid leaking the connection

  if (!res.ok) {
    throw new Error(`unexpected response: ${res.status} ${res.statusText}`);
  }
};

export const resolveDns: ResolveDnsFunction = async (domain, recordType) => {
  try {
    const records = await dohResolveDns(domain, recordType);

    if (records.length === 0) {
      // An empty answer may be a negatively cached NXDOMAIN seeded by a
      // lookup that raced record propagation — 1.1.1.1 would otherwise keep
      // serving it for the zone's full negative TTL, which outlives the
      // polling budget. Purge so the next attempt re-queries the
      // authoritative servers.
      try {
        await purgeCloudflareDnsCache(domain, recordType);
      } catch (error) {
        console.warn(
          `⚠️ Failed to purge 1.1.1.1 cache for ${domain} (${recordType}): ${error}`,
        );
      }
    }

    return records;
  } catch (error) {
    console.warn(
      `⚠️ DoH lookup failed for ${domain} (${recordType}): ${error}`,
    );
    // Treat failures as "record not visible yet" so pollDnsTxtRecord retries
    // (it surfaces thrown errors immediately) — an outage then shows up as
    // its regular polling timeout with the warnings above in the log.
    // deno-lint-ignore no-explicit-any -- Empty result preserves the resolver contract.
    return [] as any;
  }
};
