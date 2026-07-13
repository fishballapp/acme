import { createResolveDns, PUBLIC_DNS } from "@fishballpkg/acme/resolveDns.doh";

/**
 * E2E resolver used to poll for challenge TXT records.
 *
 * We deliberately resolve over DNS-over-HTTPS rather than the default
 * `Deno.resolveDns` (see `../../src/resolveDns.deno.ts`). E2E runs on
 * Blacksmith's Firecracker microVMs, whose local resolver answers `fetch`'s
 * hostname lookups but returns nothing for the external TXT queries that
 * `Deno.resolveDns` issues directly over UDP/53 — so the challenge poll would
 * never see the record and time out. DoH resolves over HTTPS (the same path
 * `fetch` already uses successfully here), so it is independent of the
 * runner's local DNS. It is also a stronger propagation signal: a real public
 * recursive resolver rather than the CI box's resolver.
 */
export const resolveDns = createResolveDns({
  endpoint: PUBLIC_DNS.cloudflare.doh[0],
});
