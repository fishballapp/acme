import { AcmeClient } from "../src/mod.ts";
import { expect, it } from "../test_deps.ts";
import { PEBBLE_DIRECTORY_URL } from "./CONSTANTS.ts";
import {
  generateRandomDomain,
  generateRandomEmail,
} from "./utils/generateRandomThings.ts";
import { setupNode } from "./utils/setupNode.ts";

setupNode();

it("should place an order correctly and get the corresponding authorizations", async () => {
  const client = await AcmeClient.init(PEBBLE_DIRECTORY_URL);

  const acmeAccount = await client.createAccount({
    emails: [generateRandomEmail()],
  });

  const domains = [generateRandomDomain(), generateRandomDomain()];
  const order = await acmeAccount.createOrder({ domains });

  expect(order.domains).not.toBe(domains);
  expect(order.domains).toEqual(domains);
  expect(order.authorizations.map((auth) => auth.domain)).toEqual(domains);
});
