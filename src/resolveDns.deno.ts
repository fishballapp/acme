import { withAuthoritativeLookup } from "./DnsUtils/withAuthoritativeLookup.ts";

// Deno's native `resolveDns` wrapped with authoritative lookup support
export const resolveDns = withAuthoritativeLookup(Deno.resolveDns);
