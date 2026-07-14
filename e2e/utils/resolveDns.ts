import { createResolveDns } from "../../src/resolveDns.doh.ts";
import { PUBLIC_DNS } from "../../src/resolveDns.nameServers.ts";

// CI runners (currently Blacksmith) sit behind their own DNS infrastructure,
// where freshly created TXT records can stay invisible to the system resolver
// for longer than our polling timeout. Resolving over DoH (plain HTTPS)
// bypasses the runner's DNS path entirely, so propagation polling behaves the
// same on any runner.
export const resolveDns = createResolveDns({
  endpoint: PUBLIC_DNS.cloudflare.doh[0],
});
