/**
 * Node.js implementation of `resolveDns`.
 *
 * This file will be used in Node.js. Thanks to DNT's build mapping. See more in `scripts/build-npm.ts`.
 */

import { Resolver } from "node:dns/promises";
import type { ResolveDnsFunction } from "./resolveDns.ts";

export const resolveDns: ResolveDnsFunction = async (
  domain,
  recordType,
  options,
) => {
  const resolver = new Resolver();
  if (options?.nameServer?.ipAddr !== undefined) {
    resolver.setServers([options.nameServer.ipAddr]);
  }

  // deno-lint-ignore no-explicit-any -- typescript is hard
  return (await resolver.resolve(domain, recordType)) as any;
};
