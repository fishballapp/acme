import {
  ACME_DIRECTORY_URLS,
  AcmeAccount,
  AcmeAuthorization,
  AcmeClient,
  AcmeOrder,
  Dns01Challenge,
  DnsUtils,
} from "../src/mod.ts";
import { expect, it } from "../test_deps.ts";
import { CloudflareZone } from "./utils/cloudflare.ts";
import { expectToBeDefined } from "./utils/expectToBeDefined.ts";
import { randomFishballTestingSubdomain } from "./utils/randomFishballTestingSubdomain.ts";

const EMAIL = "e2e-wildcard@test.acme.pkg.fishball.dev";
const DOMAIN = randomFishballTestingSubdomain(); // e.g., "abc.fishball-testing.dev"
const WILDCARD_DOMAIN = `*.${DOMAIN}`; // e.g., "*.abc.fishball-testing.dev"

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
  const acmeOrder = await acmeAccount.createOrder({ domains: [DOMAIN, WILDCARD_DOMAIN] });
  expect(acmeOrder instanceof AcmeOrder).toBe(true);
  console.log("✅ Order Creation");

  // We expect 2 authorizations (one for base, one for wildcard)
  expect(acmeOrder.authorizations.length).toBe(2);
  console.log("✅ Order > Authorization(s) count correct");

  const challengesToSolve = [];

  for (const authorization of acmeOrder.authorizations) {
    const dns01Challenge = authorization.findDns01Challenge();
    expectToBeDefined(dns01Challenge);
    expect(dns01Challenge instanceof Dns01Challenge).toBe(true);
    
    // The critical check: does the DNS record answer strip the *.?
    const expectedRecord = await dns01Challenge.getDnsRecordAnswer();
    
    // The TXT record for *.example.com must be at _acme-challenge.example.com
    // The TXT record for example.com must be at _acme-challenge.example.com
    // So both authorizations will point to the SAME record name, but different tokens.
    expect(expectedRecord.name).toBe(`_acme-challenge.${DOMAIN}.`);
    
    challengesToSolve.push({
      challenge: dns01Challenge,
      record: expectedRecord,
    });
  }
  console.log("✅ Challenges identified and DNS records validated");

  // Create DNS records (likely 2 TXT records on the same name)
  await cloudflareZone.createDnsRecords(
    challengesToSolve.map((c) => ({
      type: c.record.type,
      name: c.record.name,
      content: c.record.content,
    }))
  );
  console.log("⏳ Creating DNS records for _acme-challenge...");

  // Poll for the first record (just to ensure propagation started)
  // Since both records are on the same name, we need to make sure we find BOTH values
  const expectedContents = challengesToSolve.map(c => c.record.content);
  
  await DnsUtils.pollDnsTxtRecord(challengesToSolve[0].record.name, {
    pollUntil: (records) => {
      const flatRecords = records.flat();
      return expectedContents.every(content => flatRecords.includes(content));
    },
    onBeforeAttempt: () =>
      console.log(`⏳ Polling dns record for ${challengesToSolve[0].record.name}...`),
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
  await Promise.all(challengesToSolve.map(c => c.challenge.submit()));
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
