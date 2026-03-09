import { createResolveDns } from "../../src/resolveDns.deno.ts";
import type { ResolveDnsFunction } from "../../src/DnsUtils/resolveDns.ts";

const defaultResolveDns = createResolveDns({
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
    // Non-TXT records are intentionally unavailable in this integration helper.
    return [];
  }
  return (await defaultResolveDns(
    query,
    recordType,
  ) as unknown) as string[][];
};

export const resolveDns = resolveDnsTxtOnly as unknown as ResolveDnsFunction;
