import { AcmeClient, AcmeOrder, AcmeWorkflows } from "@fishballpkg/acme";
import { describe, expect, it } from "../test_deps.ts";
import { EMAIL, PEBBLE_DIRECTORY_URL } from "./CONSTANTS.ts";
import { generateRandomDomain } from "./utils/generateRandomDomain.ts";
import { PebbleChallTestSrv } from "./utils/PebbleChallTestSrv.ts";

const DOMAINS = [
  generateRandomDomain(),
  generateRandomDomain(),
];

const pebbleChallTestSrv = new PebbleChallTestSrv();

describe("requestCertificates", () => {
  it("should successfully get the certs for the given domains", async () => {
    const client = await AcmeClient.init(PEBBLE_DIRECTORY_URL);

    const acmeAccount = await client.createAccount({ email: EMAIL });

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
      resolveDns: async (query, recordType) => {
        return await Deno.resolveDns(query, recordType, {
          nameServer: {
            ipAddr: "127.0.0.1",
            port: 8053,
          },
        });
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
