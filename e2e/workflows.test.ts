import {
  ACME_DIRECTORY_URLS,
  AcmeClient,
  AcmeOrder,
  AcmeWorkflows,
} from "../src/mod.ts";
import { describe, expect, it } from "../test_deps.ts";
import { CloudflareZone } from "./utils/cloudflare.ts";
import { randomFishballTestingSubdomain } from "./utils/randomFishballTestingSubdomain.ts";

const EMAIL = "e2e@test.acme.pkg.fishball.xyz";
const DOMAINS = [
  randomFishballTestingSubdomain(),
  randomFishballTestingSubdomain(),
  randomFishballTestingSubdomain(),
];

const cloudflareZone = await CloudflareZone.init();

describe("requestCertificates", () => {
  it("should successfully get the certs for the given domains", async () => {
    const client = await AcmeClient.init(
      ACME_DIRECTORY_URLS.LETS_ENCRYPT_STAGING,
    );

    const acmeAccount = await client.createAccount({ emails: [EMAIL] });

    const {
      certificate,
      certKeyPair,
      acmeOrder,
    } = await AcmeWorkflows.requestCertificate({
      acmeAccount,
      domains: DOMAINS,
      updateDnsRecords: async (dnsRecords) => {
        await cloudflareZone.createDnsRecords(dnsRecords);
      },
    });

    expect(certKeyPair.privateKey).toBeInstanceOf(CryptoKey);
    expect(certKeyPair.publicKey).toBeInstanceOf(CryptoKey);
    console.log("✅ certKeyPair");

    expect(acmeOrder instanceof AcmeOrder).toBe(true);
    console.log("✅ acmeOrder");

    // TODO: verify with openssl
    console.log("✅ Certificate retrieved!");
    console.log(certificate);
  });
});
