import { AcmeClient } from "@fishballpkg/acme";
import { expect, it } from "../test_deps.ts";

const EMAIL = "test@acme.pkg.fishball.xyz";

const pebbleDirectoryUrl = "https://localhost:14000/dir";

it("should create the account successfully and the key pair should allow login", async () => {
  const client = await AcmeClient.init(pebbleDirectoryUrl);

  const acmeAccount = await client.createAccount({
    email: EMAIL,
  });

  expect(acmeAccount.keyPair.privateKey).toBeInstanceOf(CryptoKey);
  expect(acmeAccount.keyPair.publicKey).toBeInstanceOf(CryptoKey);

  const acmeAccount2 = await client.login({ keyPair: acmeAccount.keyPair });

  expect(acmeAccount2.url).toBe(acmeAccount.url);
});

it("fetch should return an account object", async () => {
  const client = await AcmeClient.init(pebbleDirectoryUrl);

  const acmeAccount = await client.createAccount({
    email: EMAIL,
  });

  expect(await acmeAccount.fetch()).toMatchObject({
    status: "valid",
    contact: [`mailto:${EMAIL}`],
  });
});
