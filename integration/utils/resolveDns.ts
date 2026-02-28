import { createResolveDns } from "../../src/resolveDns.deno.ts";
import type { ResolveDnsFunction } from "../../src/DnsUtils/resolveDns.ts";

const defaultResolveDns = createResolveDns({
  defaultAuthoritativeForTxt: false,
  nameServer: {
    ipAddr: "127.0.0.1",
    port: 8053,
  },
});

/**
 * A resolveDns function specifically for integration tests to allow TXT lookups to be done via pebble-testchallsrv
 */
const resolveDnsTxtOnly = async (query: string, recordType: "TXT") => {
  if (recordType !== "TXT") {
    // this would be treated as record not found
    throw new Error();
  }
  return (await defaultResolveDns(
    query,
    recordType,
  ) as unknown) as string[][];
};

export const resolveDns = resolveDnsTxtOnly as unknown as ResolveDnsFunction;
