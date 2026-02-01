import {
  ACME_DIRECTORY_URLS,
  AcmeAccount,
  AcmeClient,
  AcmeOrder,
  DnsUtils,
} from "../src/mod.ts";
import { expect, it } from "../test_deps.ts";
import { CloudflareZone } from "./utils/cloudflare.ts";
import { expectToBeDefined } from "./utils/expectToBeDefined.ts";
import { randomFishballTestingSubdomain } from "./utils/randomFishballTestingSubdomain.ts";

const EMAIL = "e2e-wildcard@test.acme.pkg.fishball.dev";
const DOMAIN = randomFishballTestingSubdomain(); // e.g., "abc.fishball-testing.dev"

const cloudflareZone = await CloudflareZone.init();

it("can talk to ACME server and successfully retrieve a wildcard certificate", async () => {
  const acmeClient = await AcmeClient.init(
    ACME_DIRECTORY_URLS.LETS_ENCRYPT_STAGING,
  );
  expect(acmeClient instanceof AcmeClient).toBe(true);
  console.log("✅ AcmeClient.init()");

  const acmeAccount = await acmeClient.createAccount({ emails: [EMAIL] });
  expect(acmeAccount instanceof AcmeAccount).toBe(true);
  console.log("✅ Account Creation");

  // Request both the base domain and the wildcard
  const acmeOrder = await acmeAccount.createOrder({
    domains: [DOMAIN, `*.${DOMAIN}`],
  });
  expect(acmeOrder instanceof AcmeOrder).toBe(true);
  console.log("✅ Order Creation");

  // We expect 2 authorizations (one for base, one for wildcard)
  expect(acmeOrder.authorizations.length).toBe(2);
  console.log("✅ Order > Authorization(s) count correct");

  const challenges = acmeOrder.authorizations.map((auth) => {
    const challenge = auth.findDns01Challenge();
    expectToBeDefined(challenge);
    return challenge;
  });

  const dnsTxtRecords = await Promise.all(
    challenges
      .map(async (challenge) => {
        const dnsRecord = await challenge.getDnsRecordAnswer();
        expectToBeDefined(dnsRecord);
        // The TXT record for *.example.com must be at _acme-challenge.example.com
        // The TXT record for example.com must be at _acme-challenge.example.com
        // So both authorizations will point to the SAME record name, but different tokens.
        expect(dnsRecord.name).toBe(`_acme-challenge.${DOMAIN}.`);
        return dnsRecord;
      }),
  );

  console.log("✅ Challenges identified and DNS records validated");

  // Create DNS records (likely 2 TXT records on the same name)
  await cloudflareZone.createDnsRecords(dnsTxtRecords);
  console.log("⏳ Creating DNS records for _acme-challenge...");

  await DnsUtils.pollDnsTxtRecord(`_acme-challenge.${DOMAIN}.`, {
    pollUntil: dnsTxtRecords.map(({ content }) => content),
    onBeforeAttempt: () =>
      console.log(
        `⏳ Polling dns record for ${dnsTxtRecords[0]?.name}...`,
      ),
    onAfterFailAttempt: (recordss) => {
      console.log(
        `⏳ Received DNS records: `,
        [...new Set(recordss.flat())].join(", "),
      );
    },
  });
  console.log("✅ DnsUtils.pollDnsTxtRecord() - All TXT records found!");

  // extra 5s to be safe
  await new Promise((res) => setTimeout(res, 5000));

  // Submit all challenges
  await Promise.all(challenges.map((challenge) => challenge.submit()));
  console.log("✅ Challenges Submitted");

  await acmeOrder.pollStatus({
    pollUntil: "ready",
    onBeforeAttempt: () =>
      console.log("⏳ Polling order status until it is `ready`..."),
    onAfterFailAttempt: (order) => {
      console.log(`⏳ Received status ${order.status}. Retrying later...`);
    },
  });
  console.log("✅ acmeOrder.pollStatus(ready) - Order is `ready`!");

  const certKeyPair = await acmeOrder.finalize();
  expect(certKeyPair.privateKey).toBeInstanceOf(CryptoKey);
  expect(certKeyPair.publicKey).toBeInstanceOf(CryptoKey);
  console.log("✅ Order finalized");

  await acmeOrder.pollStatus({
    pollUntil: "valid",
    onBeforeAttempt: () =>
      console.log("⏳ Polling order status until it is `valid`..."),
    onAfterFailAttempt: (order) => {
      console.log(`⏳ Received status ${order.status}. Retrying later...`);
    },
  });
  console.log("✅ acmeOrder.pollStatus(valid) - Order is `valid`!");

  const certificate = await acmeOrder.getCertificate();
  console.log("✅ Certificate retrieved!");
  console.log(certificate);
});
