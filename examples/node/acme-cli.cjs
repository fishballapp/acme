// deno-lint-ignore-file
const { Resolver } = require("node:dns").promises;
const readline = require("node:readline").promises;
const {
  ACME_DIRECTORY_URLS,
  AcmeClient,
  DnsUtils,
} = require("../../dist-npm/script/mod.js");
const { runAcmeCli } = require("../shared/run-acme-cli.cjs");

(async () => {
  await runAcmeCli({
    EMAIL: "dev@fishball.xyz",
    DOMAIN: "fishball.xyz",
    ACME_DIRECTORY_URLS,
    AcmeClient,
    DnsUtils,
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
      return resolver.resolve(domain, recordType);
    },
  });
})().catch((e) => {
  console.error(e);
});
