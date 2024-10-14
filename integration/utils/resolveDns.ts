import {
  defaultResolveDns,
  type ResolveDnsFunction,
} from "../../src/DnsUtils/resolveDns.ts";

/**
 * A resolveDns function specifically for integration tests to allow TXT lookups to be done via pebble-testchallsrv
 */
export const resolveDns: ResolveDnsFunction = async (query, recordType) => {
  return (await defaultResolveDns(query, recordType, {
    nameServer: recordType === "TXT"
      ? {
        ipAddr: "127.0.0.1",
        port: 8053,
      } // only lookup via pebble-challtestsrv for txt records
      : undefined,
    // deno-lint-ignore no-explicit-any -- typescript is hard
  })) as any;
};
