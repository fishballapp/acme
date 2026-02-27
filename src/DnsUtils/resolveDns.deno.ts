import { createAuthoritativeResolveDns } from "./_createAuthoritativeResolveDns.ts";
import type { ResolveDnsFunction } from "./resolveDns.ts";

export const resolveDns = Deno.resolveDns;

export type CreateResolveDnsOptions = {
  /**
   * When `true`, lookups will query all authoritative nameservers
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
    // deno-lint-ignore no-explicit-any -- Deno.resolveDns overloads are compatible with ResolveDnsFunction
    return createAuthoritativeResolveDns(resolveDns as any);
  }
  // deno-lint-ignore no-explicit-any -- Deno.resolveDns overloads are compatible with ResolveDnsFunction
  return resolveDns as any;
};
