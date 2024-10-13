import {
  ACME_DIRECTORY_URLS,
  AcmeAccount,
  AcmeAuthorization,
  AcmeClient,
  AcmeOrder,
  Dns01Challenge,
  DnsUtils,
} from "@fishballpkg/acme";
import { expect, it } from "../test_deps.ts";
import { CloudflareZone } from "./utils/cloudflare.ts";
import { expectToBeDefined } from "./utils/expectToBeDefined.ts";
import { randomFishballTestingSubdomain } from "./utils/randomFishballTestingSubdomain.ts";

const EMAIL = "e2e@test.acme.pkg.fishball.xyz";
const DOMAIN = randomFishballTestingSubdomain();

const cloudflareZone = await CloudflareZone.init();

it("can talk to ACME server and successfully create an account, order then all the way to retrieve the certificate for 1 domain", async () => {
  const acmeClient = await AcmeClient.init(
    ACME_DIRECTORY_URLS.LETS_ENCRYPT_STAGING,
  );
  expect(acmeClient instanceof AcmeClient).toBe(true);
  console.log("✅ AcmeClient.init()");

  const acmeAccount = await acmeClient.createAccount({ email: EMAIL });
  expect(acmeAccount instanceof AcmeAccount).toBe(true);
  console.log("✅ Account Creation");

  const acmeOrder = await acmeAccount.createOrder({ domains: [DOMAIN] });
  expect(acmeOrder instanceof AcmeOrder).toBe(true);
  console.log("✅ Order Creation");

  expect(acmeOrder.authorizations.length).toBe(1);
  const [authorization] = acmeOrder.authorizations;
  expectToBeDefined(authorization);
  expect(authorization instanceof AcmeAuthorization).toBe(true);
  console.log("✅ Order > Authorization(s)");

  const dns01Challenge = authorization.findDns01Challenge();
  expectToBeDefined(dns01Challenge);
  expect(dns01Challenge instanceof Dns01Challenge).toBe(true);
  console.log("✅ Order > Authorization(s) > dns-01 challenge (found!)");

  const expectedRecord = await dns01Challenge.getDnsRecordAnswer();
  console.log("✅ Challenge token digested!");

  await cloudflareZone.createDnsRecords([{
    type: expectedRecord.type,
    name: expectedRecord.name,
    content: expectedRecord.content,
  }]);
  console.log("⏳ Creating DNS record for _acme-challenge...");

  await DnsUtils.pollDnsTxtRecord(expectedRecord.name, {
    pollUntil: expectedRecord.content,
    onBeforeAttempt: () =>
      console.log(`⏳ Polling dns record for ${expectedRecord.name}...`),
    onAfterFailAttempt: (recordss) => {
      console.log(
        `⏳ Received DNS recordss: `,
        [...new Set(recordss.flat())].join(", "),
      );
    },
  });
  console.log("✅ Dns01ChallengeUtils.pollDnsTxtRecord() - TXT record found!");

  // extra 5s to be safe
  await new Promise((res) => setTimeout(res, 5000));

  await dns01Challenge.submit();
  console.log("✅ Challenge Submission");

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
  // TODO: verify with openssl
  console.log("✅ Certificate retrieved!");
  console.log(certificate);
});
