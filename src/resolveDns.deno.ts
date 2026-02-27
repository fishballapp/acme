import type { ResolveDnsFunction } from "./DnsUtils/resolveDns.ts";
import { withAuthoritativeLookup } from "./DnsUtils/withAuthoritativeLookup.ts";

// Deno's native `resolveDns` wrapped with authoritative lookup support
export const resolveDns: ResolveDnsFunction = withAuthoritativeLookup(
  Deno.resolveDns as ResolveDnsFunction,
);
