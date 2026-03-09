import { describe, expect, it } from "../../test_deps.ts";
import { createUnanimousResolveDns } from "./createUnanimousResolveDns.ts";
import type { ResolveDnsFunction } from "./resolveDns.ts";

type MockRecords = {
  A: string[];
  AAAA: string[];
  NS: string[];
  TXT: string[][];
};

const createMockResolveDns = (records: MockRecords): ResolveDnsFunction => {
  return (_query, recordType) => {
    // deno-lint-ignore no-explicit-any -- TS generic inference for conditional return type is difficult here.
    return Promise.resolve(records[recordType] as any);
  };
};

const createRejectingResolveDns = (
  error: Error & { code?: string },
): ResolveDnsFunction => {
  return () => Promise.reject(error);
};

describe("createUnanimousResolveDns", () => {
  it("returns TXT records that are visible from all resolvers", async () => {
    const resolveDns = createUnanimousResolveDns([
      createMockResolveDns({
        A: [],
        AAAA: [],
        NS: [],
        TXT: [["a"], ["b"], ["shared"]],
      }),
      createMockResolveDns({
        A: [],
        AAAA: [],
        NS: [],
        TXT: [["b"], ["shared"]],
      }),
      createMockResolveDns({
        A: [],
        AAAA: [],
        NS: [],
        TXT: [["shared"], ["c"]],
      }),
    ]);

    await expect(resolveDns("example.com", "TXT")).resolves.toEqual([
      ["shared"],
    ]);
  });

  it("returns non-TXT records that are visible from all resolvers", async () => {
    const resolveDns = createUnanimousResolveDns([
      createMockResolveDns({
        A: ["1.1.1.1", "8.8.8.8"],
        AAAA: ["2001:db8::1"],
        NS: ["ns1.example.com", "ns-shared.example.com"],
        TXT: [],
      }),
      createMockResolveDns({
        A: ["8.8.8.8", "9.9.9.9"],
        AAAA: ["2001:db8::1", "2001:4860:4860::8888"],
        NS: ["ns2.example.com", "ns-shared.example.com"],
        TXT: [],
      }),
    ]);

    await expect(resolveDns("example.com", "A")).resolves.toEqual([
      "8.8.8.8",
    ]);
    await expect(resolveDns("example.com", "AAAA")).resolves.toEqual([
      "2001:db8::1",
    ]);
    await expect(resolveDns("example.com", "NS")).resolves.toEqual([
      "ns-shared.example.com",
    ]);
  });

  it("treats empty results as empty results", async () => {
    const resolveDns = createUnanimousResolveDns([
      createMockResolveDns({
        A: ["1.1.1.1"],
        AAAA: [],
        NS: [],
        TXT: [["shared"]],
      }),
      createMockResolveDns({
        A: [],
        AAAA: [],
        NS: [],
        TXT: [],
      }),
    ]);

    await expect(resolveDns("example.com", "TXT")).resolves.toEqual([]);
    await expect(resolveDns("example.com", "A")).resolves.toEqual([]);
  });

  it("propagates unexpected resolver failures", async () => {
    const resolveDns = createUnanimousResolveDns([
      createMockResolveDns({
        A: ["1.1.1.1"],
        AAAA: [],
        NS: [],
        TXT: [["shared"]],
      }),
      createRejectingResolveDns(
        Object.assign(
          new Error("queryTxt ECONNREFUSED example.com"),
          { code: "ECONNREFUSED" },
        ),
      ),
    ]);

    await expect(resolveDns("example.com", "TXT")).rejects.toThrow(
      "queryTxt ECONNREFUSED example.com",
    );
  });

  it("throws when no resolvers are provided", () => {
    expect(() => createUnanimousResolveDns([])).toThrow(
      "Expected at least 1 resolver",
    );
  });
});
