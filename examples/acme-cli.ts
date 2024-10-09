import {
  ACME_DIRECTORY_URLS,
  AcmeClient,
  Dns01ChallengeUtils,
} from "../src/mod.ts";

export const DOMAIN = "dynm.link";
const EMAIL = "dev@dynm.link";

console.log("Initializing acme client... (this fetches the directory)");
const acmeClient = await AcmeClient.init(
  ACME_DIRECTORY_URLS.LETS_ENCRYPT_STAGING,
);

console.log("Creating account...");
const acmeAccount = await acmeClient.createAccount({ email: EMAIL });

console.log(`Creating order for "${DOMAIN}"...`);
const acmeOrder = await acmeAccount.createOrder({ domains: [DOMAIN] });

console.log(`Digesting authorization...`);
const [authorization] = acmeOrder.authorizations;

if (authorization === undefined) {
  throw new Error("cannot find authorization");
}

const dns01Challenge = authorization.findChallenge("dns-01") ?? (() => {
  throw new Error("DNS-01 challenge not found");
})();

const expectedRecord = {
  domain: `_acme-challenge.${DOMAIN}.`,
  content: await dns01Challenge.digestToken(),
};

console.log(`Please update your DNS record as follows:`);
console.table([
  {
    type: "TXT",
    name: expectedRecord.domain,
    content: expectedRecord.content,
  },
]);

alert("After updating the DNS records, press enter to continue...");

console.log("Polling DNS to verify txt is updated...");
await Dns01ChallengeUtils.pollDnsTxtRecord({
  domain: expectedRecord.domain,
  pollUntil: expectedRecord.content,
  onBeforeEachAttempt: () => {
    console.log(`Looking up DNS records for ${expectedRecord.domain}...`);
  },
  onAfterFailAttempt: (records) => {
    console.log("Attempt failed. Found these instead:");
    console.log(`{ ${[...new Set(records.flat())].join(", ")} }`, "\n");
    console.log("Please ensure you have updated the DNS record as follows:");
    console.table([
      {
        type: "TXT",
        name: expectedRecord.domain,
        content: expectedRecord.content,
      },
    ]);

    console.log("Retrying later...");
  },
});

console.log("Records found!");

console.log("Submitting challenge...");
await dns01Challenge.submit();

console.log('Polling order status until "ready"...');
await acmeOrder.pollOrderStatus(
  {
    pollUntil: "ready",
    onBeforeAttempt: () => console.log("Fetching order..."),
    onAfterFailAttempt: (o) => {
      console.log(`Received status ${o.status}. Retrying later...`);
    },
  },
);

console.log("Order is ready. Finalizing...");
console.log("Submiting CSR");
// use the CryptoKeyPair if you need to?
const _csrKeyPair = await acmeOrder.finalize();

console.log("CSR submitted! Polling order till certificate is ready...");

await acmeOrder
  .pollOrderStatus(
    {
      pollUntil: "valid",
      onBeforeAttempt: () => console.log("polling order status..."),
      onAfterFailAttempt: (order) => {
        console.log(`Received status ${order.status}. Retrying later...`);
      },
    },
  );

console.log("Order finalized. Downloading certificate...");

const certificate = await acmeOrder.getCertificate();
console.log("\nCertificate is ready:");
console.log(certificate);
