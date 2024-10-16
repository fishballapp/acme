// 01 prefix to this file because of https://github.com/denoland/dnt/issues/432
import { AcmeClient, AcmeOrder, AcmeWorkflows, CertUtils } from "../src/mod.ts";
import { describe, expect, it } from "../test_deps.ts";
import { PEBBLE_DIRECTORY_URL } from "./CONSTANTS.ts";
import {
  generateRandomDomain,
  generateRandomEmail,
} from "./utils/generateRandomThings.ts";
import { PebbleChallTestSrv } from "./utils/PebbleChallTestSrv.ts";
import { resolveDns } from "./utils/resolveDns.ts";
import { setupNode } from "./utils/setupNode.ts";

setupNode();

const DOMAINS = [
  generateRandomDomain(),
  generateRandomDomain(),
];

const pebbleChallTestSrv = new PebbleChallTestSrv();

describe("requestCertificates", () => {
  it("should successfully get the certs for the given domains", async () => {
    const client = await AcmeClient.init(PEBBLE_DIRECTORY_URL);

    const acmeAccount = await client.createAccount({
      emails: [generateRandomEmail(), generateRandomEmail()],
    });

    const {
      certificate,
      certKeyPair,
      acmeOrder,
    } = await AcmeWorkflows.requestCertificate({
      acmeAccount,
      domains: DOMAINS,
      updateDnsRecords: async (dnsRecords) => {
        await pebbleChallTestSrv.createDnsRecords(dnsRecords);
      },
      resolveDns,
    });

    expect(certKeyPair.privateKey).toBeInstanceOf(CryptoKey);
    expect(certKeyPair.publicKey).toBeInstanceOf(CryptoKey);
    console.log("✅ certKeyPair");

    expect(acmeOrder instanceof AcmeOrder).toBe(true);
    console.log("✅ acmeOrder");

    // TODO: verify with openssl
    console.log("✅ Certificate retrieved!");
    console.log(certificate);

    const { notBefore, notAfter } = CertUtils.decodeValidity(certificate);
    expect(notBefore).toBeInstanceOf(Date);
    expect(notAfter).toBeInstanceOf(Date);
    expect(notBefore.getTime()).toBeLessThan(Date.now());
    expect(notAfter.getTime()).toBeGreaterThan(Date.now());
  });
});
