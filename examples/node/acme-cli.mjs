// deno-lint-ignore-file
import { Resolver } from "node:dns/promises";
import readline from "node:readline/promises";
import {
  ACME_DIRECTORY_URLS,
  AcmeClient,
  Dns01ChallengeUtils,
} from "../../dist-npm/esm/mod.js";
import { runAcmeCli } from "../shared/run-acme-cli.mjs";

await runAcmeCli({
  EMAIL: "dev@fishball.xyz",
  DOMAIN: "fishball.xyz",
  ACME_DIRECTORY_URLS,
  AcmeClient,
  Dns01ChallengeUtils,
  alert: async () => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    await rl.question(
      "After updating the DNS records, press enter to continue...",
    );
    rl.close();
  },
  resolveDns: (domain, recordType, options) => {
    const resolver = new Resolver();
    if (options?.nameServer?.ipAddr !== undefined) {
      resolver.setServers([options.nameServer.ipAddr]);
    }
    switch (recordType) {
      case "A":
        return resolver.resolve(domain);
      case "TXT":
        return resolver.resolveTxt(domain);
      case "NS":
        return resolver.resolveNs(domain);
    }
  },
});
