/**
 * @module
 * Some predefined common patterns to interact with the ACME client.
 */

import type { AcmeAccount } from "./AcmeAccount.ts";
import type { DnsTxtRecord } from "./AcmeChallenge.ts";
import type { AcmeOrder } from "./AcmeOrder.ts";
import * as Dns01ChallengeUtils from "./Dns01ChallengeUtils.ts";

export type RequestCertificatesConfig = {
  acmeAccount: AcmeAccount;
  domains: string[];
  updateDnsRecords: (dnsRecord: DnsTxtRecord[]) => Promise<void>;
  /**
   * The number of milliseconds to wait after the DnsRecords
   * are confirmed by the client and before submitting the challenge.
   *
   * The longer the wait the higher the chance of success as it
   * will allow the DNS records to propogate properly.
   *
   * Default: `5000`
   */
  delayAfterDnsRecordsConfirmed?: number;
  resolveDns?: Dns01ChallengeUtils.ResolveDnsFunction;
  /**
   * The number of milliseconds to poll resources before giving up and throw an error.
   *
   * Default: `30000`
   */
  timeout?: number;
};

/**
 * Request a certificate using the given list of domains.
 *
 * The brief steps involved are:
 * 1. Create a new order
 * 2. Set the dns records required for the challenges
 * 3. Poll the dns until the records are verified
 * 4. Submit the challenge
 * 5. Poll until the order is `ready`
 * 6. Finalize the order by submitting a Certificate Signing Request (CSR)
 * 7. Poll until the order is `valid`
 * 8. Retrieve the certificate
 */
export const requestCertificate = async (
  config: RequestCertificatesConfig,
): Promise<
  {
    certificate: string;
    certKeyPair: CryptoKeyPair;
    acmeOrder: AcmeOrder;
  }
> => {
  const {
    acmeAccount,
    domains,
    updateDnsRecords,
    delayAfterDnsRecordsConfirmed = 5000,
    resolveDns,
    timeout,
  } = config;

  const acmeOrder = await acmeAccount.createOrder({ domains });

  const dns01Challenges = acmeOrder.authorizations.map((authorization) => {
    const challenge = authorization.findDns01Challenge();
    if (challenge === undefined) {
      throw new Error(
        `Cannot find dns01 challenge for authorization ${
          JSON.stringify(authorization)
        }.`,
      );
    }
    return challenge;
  });

  const expectedRecords = await Promise.all(
    dns01Challenges.map(async (dns01Challenge) =>
      await dns01Challenge.getDnsRecordAnswer()
    ),
  );

  await updateDnsRecords(expectedRecords);

  await Promise.all(expectedRecords.map(async (expectedRecord) => {
    await Dns01ChallengeUtils.pollDnsTxtRecord({
      timeout,
      domain: expectedRecord.name,
      pollUntil: expectedRecord.content,
      resolveDns,
    });
  }));

  await new Promise((res) => setTimeout(res, delayAfterDnsRecordsConfirmed));

  await Promise.all(
    dns01Challenges.map(async (challenge) => await challenge.submit()),
  );

  await acmeOrder.pollStatus({ pollUntil: "ready", timeout });

  const certKeyPair = await acmeOrder.finalize();

  await acmeOrder.pollStatus({ pollUntil: "valid", timeout });

  const certificate = await acmeOrder.getCertificate();
  return { certificate, certKeyPair, acmeOrder };
};
