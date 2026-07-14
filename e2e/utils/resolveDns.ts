import type { ResolveDnsFunction } from "../../src/DnsUtils/resolveDns.ts";
import { createResolveDns } from "../../src/resolveDns.doh.ts";
import { PUBLIC_DNS } from "../../src/resolveDns.nameServers.ts";

// CI runners (currently Blacksmith) sit behind their own DNS infrastructure,
// where freshly created TXT records can stay invisible to the system resolver
// for longer than our polling timeout. Resolving over DoH (plain HTTPS)
// bypasses the runner's DNS path entirely, so propagation polling behaves the
// same on any runner.
const dohResolveDns = createResolveDns({
  endpoint: PUBLIC_DNS.cloudflare.doh[0],
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
    // This endpoint is unofficial, so don't let a stalled request block the
    // polling loop indefinitely.
    signal: AbortSignal.timeout(10_000),
  });
  await res.text(); // consume the body to avoid leaking the connection

  if (!res.ok) {
    throw new Error(`unexpected response: ${res.status} ${res.statusText}`);
  }
};

export const resolveDns: ResolveDnsFunction = async (domain, recordType) => {
  // Purge 1.1.1.1's cache before every lookup so polling keeps re-querying
  // the authoritative servers: a lookup that races record propagation would
  // otherwise cache NXDOMAIN for the zone's full negative TTL, which outlives
  // the polling budget (observed in e2e runs 78 and 86). The purge applies
  // asynchronously on Cloudflare's side, so a lookup may still see the cache
  // as it was one attempt ago — polling converges an attempt later.
  try {
    console.log(`🧹 Purging 1.1.1.1 cache for ${domain} (${recordType})...`);
    await purgeCloudflareDnsCache(domain, recordType);
  } catch (error) {
    console.warn(
      `⚠️ Failed to purge 1.1.1.1 cache for ${domain} (${recordType}): ${error}`,
    );
  }

  return await dohResolveDns(domain, recordType);
};
