import { AcmeClient } from "../src/mod.ts";
import { expect, it } from "../test_deps.ts";
import { EMAIL, PEBBLE_DIRECTORY_URL } from "./CONSTANTS.ts";
import { setupNode } from "./utils/setupNode.ts";

setupNode();

it("should create the account successfully and the key pair should allow login", async () => {
  const client = await AcmeClient.init(PEBBLE_DIRECTORY_URL);

  const acmeAccount = await client.createAccount({
    email: EMAIL,
  });

  expect(acmeAccount.keyPair.privateKey).toBeInstanceOf(CryptoKey);
  expect(acmeAccount.keyPair.publicKey).toBeInstanceOf(CryptoKey);

  const acmeAccount2 = await client.login({ keyPair: acmeAccount.keyPair });

  expect(acmeAccount2.url).toBe(acmeAccount.url);
});

it("fetch should return an account object", async () => {
  const client = await AcmeClient.init(PEBBLE_DIRECTORY_URL);

  const acmeAccount = await client.createAccount({
    email: EMAIL,
  });

  expect(await acmeAccount.fetch()).toMatchObject({
    status: "valid",
    contact: [`mailto:${EMAIL}`],
  });
});
