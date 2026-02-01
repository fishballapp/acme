import {
  ACME_DIRECTORY_URLS,
  AcmeClient,
  DnsUtils,
  TimeoutError,
} from "@fishballpkg/acme";

const alertList = (...messages: string[]) => {
  for (const message of messages) {
    alert(`${message}`);
  }
};

alertList(
  `👋 Hello! This is a demo showcasing how @fishballpkg/acme can easily retrieve a CA-signed certificate using ACME.`,
  `@fishballpkg/acme is written in pure-TypeScript from the ground up with zero-dependencies.`,
  `This means there is no need to install any external libraries like openssl, certbot etc.`,
);
console.log();

alertList(
  `This program will make use of Let's Encrypt (Staging) to generate a certificate for your domain.`,
  `Before we begin, please make sure you have access to a domain name and control over its DNS records.`,
);

console.log();
console.log(
  "To get started, we will need to create an account with an email address. (Doesn't matter if it's real as we are just using the Staging server of Let's Encrypt)",
);
const EMAIL = (() => {
  while (true) {
    const email = prompt("Email Address:") ?? "";

    if (email.length > 0) return email;
    console.error("️⚠️ Please provide an email address...");
  }
})();

console.log();
const acmeClient = await AcmeClient.init(
  ACME_DIRECTORY_URLS.LETS_ENCRYPT_STAGING,
);
console.log("✅ Client initiated!");

const acmeAccount = await acmeClient.createAccount({ emails: [EMAIL] });
console.log("✅ Account created!");

console.log();
console.log(
  `Next, please tell us the domain(s) you'd like to create certificate for. (This has to be real domain(s) you have control over.)`,
);
const DOMAINS = (() => {
  while (true) {
    const domainsInputString = prompt("Domain(s) (comma seperated):") ?? "";
    if (domainsInputString.length > 0) {
      return domainsInputString.split(",").map((domain) => domain.trim());
    }
    console.error("⚠️ Please provide at least one domain...");
  }
})();

const acmeOrder = await acmeAccount.createOrder({ domains: DOMAINS });
console.log("✅ Order created!");

const dns01Challenges = acmeOrder.authorizations.map((auth) =>
  auth.findDns01Challenge() ?? (() => {
    throw new Error(
      "Unexpected! DNS-01 challenge not found. The ACME server is not returning a DNS-01 challenge. This is DEFINITELY not our fault... (I guess...)",
    );
  })()
);

const expectedRecords = await Promise.all(
  dns01Challenges.map(async (challenge) =>
    await challenge.getDnsRecordAnswer()
  ),
);

while (true) {
  console.table(expectedRecords);
  console.log(
    `To verify your domains with Let's Encrypt (Staging), please update your DNS records as shown above.`,
  );
  while (!confirm("Are the DNS records updated?"));

  console.log("⏳ Polling DNS to verify TXT records are updated correctly...");
  try {
    await Promise.all(expectedRecords.map(async ({ name, content }) => {
      await DnsUtils.pollDnsTxtRecord(name, { pollUntil: content });
    }));
    break;
  } catch (e) {
    if (e instanceof TimeoutError) {
      console.error("😢 The polling has timed out.");
    }
  }
}

console.log("✅ DNS records found!");

console.log(
  "⏳ Waiting for a further 15 seconds to ensure the DNS changes have fully propagated across all servers...",
);
await new Promise((res) => setTimeout(res, 15000));

await Promise.all(
  dns01Challenges.map(async (challenge) => await challenge.submit()),
);
console.log("✅ Challenges submitted!");

console.log('⏳ Polling order status until "ready"...');
await acmeOrder.pollStatus({ pollUntil: "ready" });
console.log(
  '✅ Order status is "ready"! This means the CA now recognize your control over those domains!',
);

// the private key lives in _certKeyPair! But it's not used in this example! In reality, you probably want to use it for your HTTPS server.
const _certKeyPair = await acmeOrder.finalize();
console.log(
  "✅ Order is finalized! This means the Certificate Signing Request (CSR) is sent to the ACME server.",
);

console.log('⏳ Polling order status until "valid"...');
await acmeOrder.pollStatus({ pollUntil: "valid" });
console.log(
  `✅ Order status is "valid"! This means the CA has signed your certificate and it's now ready for download!`,
);

console.log("⏳ Downloading certificate...");
const certificate = await acmeOrder.getCertificate();
alert("✅ The certificate is ready. Ready to see it?");
console.log(certificate);

console.log(
  "🎉 Congratulations! You have retrieved the certificate!",
);
console.log(
  `💡 Please be reminded that this certificate is retrieved from Let's Encrypt (Staging) and it is not for production use.`,
);

console.log();

alert("Wait! There's still one more thing...");

console.log();

console.log(
  "✨ @fishballpkg/acme simplifies interactions with ACME servers with simple, intuitive APIs.",
);
console.log("🔗 Find out more at https://jsr.io/@fishballpkg/acme");
console.log();
console.log("Made with ❤️ by YCM Jason");
