import { AcmeClient } from "../src/mod.ts";
import { expect, it } from "../test_deps.ts";
import { PEBBLE_DIRECTORY_URL } from "./CONSTANTS.ts";
import { generateRandomEmail } from "./utils/generateRandomThings.ts";
import { setupNode } from "./utils/setupNode.ts";

setupNode();

it("should create the account successfully and the key pair should allow login", async () => {
  const [accountUrl, keyPair] = await (async () => {
    const client = await AcmeClient.init(PEBBLE_DIRECTORY_URL);

    const acmeAccount = await client.createAccount({
      emails: [generateRandomEmail()],
    });

    expect(acmeAccount.keyPair.privateKey).toBeInstanceOf(CryptoKey);
    expect(acmeAccount.keyPair.publicKey).toBeInstanceOf(CryptoKey);

    return [acmeAccount.url, acmeAccount.keyPair];
  })();

  const client = await AcmeClient.init(PEBBLE_DIRECTORY_URL);
  const acmeAccount = await client.login({ keyPair });

  expect(acmeAccount.url).toBe(accountUrl);
});

it("fetch should return an account object", async () => {
  const client = await AcmeClient.init(PEBBLE_DIRECTORY_URL);

  const emails = [generateRandomEmail(), generateRandomEmail()];

  const acmeAccount = await client.createAccount({
    emails,
  });

  expect(await acmeAccount.fetch()).toMatchObject({
    status: "valid",
    contact: emails.map((email) => `mailto:${email}`),
  });
});

it("should update account contacts correctly", async () => {
  const client = await AcmeClient.init(PEBBLE_DIRECTORY_URL);

  const emails = [generateRandomEmail(), generateRandomEmail()];

  const acmeAccount = await client.createAccount({
    emails,
  });

  expect(await acmeAccount.fetch()).toMatchObject({
    status: "valid",
    contact: emails.map((email) => `mailto:${email}`),
  });

  const newEmails = [
    generateRandomEmail(),
  ];
  const updatedAccountObject = await acmeAccount.update({ emails: newEmails });

  expect(updatedAccountObject.contact).toEqual(
    newEmails.map((email) => `mailto:${email}`),
  );
});
