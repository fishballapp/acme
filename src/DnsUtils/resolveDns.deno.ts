import { createAuthoritativeResolveDns } from "./_createAuthoritativeResolveDns.ts";
import type { ResolveDnsFunction } from "./resolveDns.ts";

export const resolveDns: ResolveDnsFunction = Deno.resolveDns;

export type CreateResolveDnsOptions = {
  /**
   * When `true`, TXT lookups will query all authoritative nameservers
   * individually and only return records present in ALL of them.
   *
   * This is useful for verifying DNS propagation during ACME DNS-01 challenges.
   *
   * Default: `false`
   */
  queryAuthoritativeNameServers?: boolean;
};

export const createResolveDns = (
  options: CreateResolveDnsOptions = {},
): ResolveDnsFunction => {
  if (options.queryAuthoritativeNameServers) {
    return createAuthoritativeResolveDns(resolveDns);
  }
  return resolveDns;
};
