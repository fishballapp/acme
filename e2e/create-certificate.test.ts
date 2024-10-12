import {
  ACME_DIRECTORY_URLS,
  AcmeAccount,
  AcmeAuthorization,
  AcmeClient,
  AcmeOrder,
  Dns01ChallengeUtils,
} from "@fishballpkg/acme";
import { afterEach, dotenv, expect, it, path } from "../test_deps.ts";
import { CloudflareZone } from "./utils/cloudflare.ts";
import { expectToBeDefined } from "./utils/expectToBeDefined.ts";

await dotenv.load({
  envPath: path.join(import.meta.dirname!, "../.env.e2e.local"), // Uses .env_prod instead of .env
  export: true, // Exports all variables to the environment
});

const EMAIL = "e2e@test.acme.pkg.fishball.xyz";
const DOMAIN = "test.acme.pkg.fishball.xyz";

const CLOUDFLARE_SECRETS = {
  API_KEY: Deno.env.get("CLOUDFLARE_API_KEY") ?? (() => {
    throw new Error("Cannot find cloudflare API key (`CLOUDFLARE_API_KEY`)");
  })(),
  FISHBALL_XYZ_ZONE_ID: Deno.env.get("CLOUDFLARE_FISHBALL_XYZ_ZONE_ID") ??
    (() => {
      throw new Error(
        "Cannot find cloudflare zone id for fishball.xyz (`CLOUDFLARE_FISHBALL_XYZ_ZONE_ID`)",
      );
    })(),
};

const cloudflareZone = new CloudflareZone({
  apiKey: CLOUDFLARE_SECRETS.API_KEY,
  zoneId: CLOUDFLARE_SECRETS.FISHBALL_XYZ_ZONE_ID,
});

afterEach(async () => await cloudflareZone.cleanup());

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

  const dns01Challenge = authorization.findChallenge("dns-01");
  expectToBeDefined(dns01Challenge);
  console.log("✅ Order > Authorization(s) > dns-01 challenge (found!)");

  const expectedRecord = {
    domain: `_acme-challenge.${DOMAIN}.`,
    content: await dns01Challenge.digestToken(),
  };
  console.log("✅ Challenge token digested!");

  await cloudflareZone.createDnsRecord({
    type: "TXT",
    name: expectedRecord.domain,
    content: expectedRecord.content,
  });
  console.log("⏳ Creating DNS record for _acme-challenge...");

  await Dns01ChallengeUtils.pollDnsTxtRecord({
    domain: expectedRecord.domain,
    pollUntil: expectedRecord.content,
    onBeforeAttempt: () =>
      console.log(`⏳ Polling dns record for ${expectedRecord.domain}...`),
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

  const csrKeyPair = await acmeOrder.finalize();
  expect(csrKeyPair.privateKey).toBeInstanceOf(CryptoKey);
  expect(csrKeyPair.publicKey).toBeInstanceOf(CryptoKey);
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
  console.log(certificate);
  console.log("✅ Certificate retrieved!");
});
