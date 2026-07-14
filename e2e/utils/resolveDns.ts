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

export const resolveDns: ResolveDnsFunction = async (domain, recordType) => {
  for (const { name, resolve } of RESOLVERS) {
    try {
      return await resolve(domain, recordType);
    } catch (error) {
      console.warn(
        `⚠️ DoH lookup via ${name} failed for ${domain} (${recordType}): ${error}`,
      );
    }
  }

  // Treat unreachable resolvers as "record not visible yet":
  // pollDnsTxtRecord surfaces thrown errors immediately, so returning []
  // keeps it retrying and a full DoH outage shows up as its regular polling
  // timeout with the warnings above in the log, instead of aborting the test.
  // deno-lint-ignore no-explicit-any -- Empty result preserves the resolver contract.
  return [] as any;
};
