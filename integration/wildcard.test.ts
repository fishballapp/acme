import { AcmeClient } from "../src/mod.ts";
import { expect, it } from "../test_deps.ts";
import { PEBBLE_DIRECTORY_URL } from "./CONSTANTS.ts";
import {
  generateRandomDomain,
  generateRandomEmail,
} from "./utils/generateRandomThings.ts";
import { setupNode } from "./utils/setupNode.ts";

setupNode();

it("should handle wildcard domains correctly", async () => {
  const client = await AcmeClient.init(PEBBLE_DIRECTORY_URL);

  const acmeAccount = await client.createAccount({
    emails: [generateRandomEmail()],
  });

  const baseDomain = generateRandomDomain();
  const wildcardDomain = `*.${baseDomain}`;
  const domains = [wildcardDomain, baseDomain];

  const order = await acmeAccount.createOrder({ domains });

  expect(order.domains).toEqual(domains);

  // Verify authorizations are mapped correctly
  const authDomains = order.authorizations.map((auth) => auth.domain);
  expect(authDomains).toContain(wildcardDomain);
  expect(authDomains).toContain(baseDomain);
  expect(authDomains.length).toBe(2);

  // Verify the wildcard authorization specifically
  const wildcardAuth = order.authorizations.find((a) =>
    a.domain === wildcardDomain
  );
  expect(wildcardAuth).toBeDefined();

  // In a real scenario we'd check for the wildcard flag in the snapshot,
  // but it's private in the class. The fact that .domain returns the wildcard
  // version proves our fix works because the raw identifier.value is just the base domain.

  // Verify that the DNS record name does NOT contain the wildcard prefix
  const dnsChallenge = wildcardAuth!.findDns01Challenge();
  expect(dnsChallenge).toBeDefined();

  const dnsRecord = await dnsChallenge!.getDnsRecordAnswer();
  expect(dnsRecord.name).toBe(`_acme-challenge.${baseDomain}.`);
});
