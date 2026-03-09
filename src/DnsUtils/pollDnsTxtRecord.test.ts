import { describe, expect, it } from "../../test_deps.ts";
import { pollDnsTxtRecord } from "./pollDnsTxtRecord.ts";
import type { ResolveDnsFunction } from "./resolveDns.ts";

const createDnsError = (code: string, message: string): Error & {
  code: string;
} => Object.assign(new Error(message), { code });

describe("pollDnsTxtRecord", () => {
  it("retries when the TXT record is not found yet", async () => {
    let attempts = 0;
    const failAttempts: string[][][] = [];

    const resolveDns: ResolveDnsFunction = (_domain, recordType) => {
      attempts += 1;
      expect(recordType).toBe("TXT");

      if (attempts === 1) {
        // deno-lint-ignore no-explicit-any -- The mock only serves the requested record type.
        return Promise.resolve([] as any);
      }

      // deno-lint-ignore no-explicit-any -- The mock only serves the requested record type.
      return Promise.resolve([["expected-value"]] as any);
    };

    await expect(pollDnsTxtRecord("example.com", {
      pollUntil: "expected-value",
      resolveDns,
      interval: 0,
      timeout: 50,
      onAfterFailAttempt: (recordss) => failAttempts.push(recordss),
    })).resolves.toBeUndefined();

    expect(attempts).toBe(2);
    expect(failAttempts).toEqual([[[]]]);
  });

  it("surfaces unexpected resolver failures immediately", async () => {
    const resolveDns: ResolveDnsFunction = () => {
      return Promise.reject(createDnsError(
        "ECONNREFUSED",
        "queryTxt ECONNREFUSED example.com",
      ));
    };

    await expect(pollDnsTxtRecord("example.com", {
      pollUntil: "expected-value",
      resolveDns,
      interval: 0,
      timeout: 50,
    })).rejects.toThrow("queryTxt ECONNREFUSED example.com");
  });
});
