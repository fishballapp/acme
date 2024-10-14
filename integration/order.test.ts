import { AcmeClient } from "@fishballpkg/acme";
import { expect, it } from "../test_deps.ts";
import { EMAIL, PEBBLE_DIRECTORY_URL } from "./CONSTANTS.ts";
import { generateRandomDomain } from "./utils/generateRandomDomain.ts";

it("should place an order correctly and get the corresponding authorizations", async () => {
  const client = await AcmeClient.init(PEBBLE_DIRECTORY_URL);

  const acmeAccount = await client.createAccount({ email: EMAIL });

  const domains = [generateRandomDomain(), generateRandomDomain()];
  const order = await acmeAccount.createOrder({ domains });

  expect(order.domains).not.toBe(domains);
  expect(order.domains).toEqual(domains);
  expect(order.authorizations.map((auth) => auth.domain)).toEqual(domains);
});
