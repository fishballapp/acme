import {
  defaultResolveDns,
  type ResolveDnsFunction,
} from "../../src/DnsUtils/resolveDns.ts";

/**
 * A resolveDns function specifically for integration tests to allow TXT lookups to be done via pebble-testchallsrv
 */
export const resolveDns: ResolveDnsFunction = async (query, recordType) => {
  if (recordType !== "TXT") {
    // this would be treated as record not found
    throw new Error();
  }
  return (await defaultResolveDns(query, recordType, {
    nameServer: {
      ipAddr: "127.0.0.1",
      port: 8053,
    },
  } // deno-lint-ignore no-explicit-any -- typescript is hard
  )) as any;
};
