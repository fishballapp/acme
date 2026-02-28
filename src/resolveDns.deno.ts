import type { ResolveDnsFunction } from "./DnsUtils/resolveDns.ts";
import { withAuthoritativeLookup } from "./DnsUtils/withAuthoritativeLookup.ts";

export type ResolveDnsDenoOptions = {
  /**
   * Whether TXT lookups should use authoritative name server intersection by
   * default. This can still be overridden per call using
   * `options.authoritative`.
   *
   * Default: `true`
   */
  defaultAuthoritativeForTxt?: boolean;
};

const baseResolveDns: ResolveDnsFunction = Deno.resolveDns;

export const createResolveDns = (
  options: ResolveDnsDenoOptions = {},
): ResolveDnsFunction => {
  const { defaultAuthoritativeForTxt = true } = options;

  return withAuthoritativeLookup(baseResolveDns, {
    defaultAuthoritativeForTxt,
  });
};

export const resolveDns: ResolveDnsFunction = createResolveDns();
