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

describe("createUnanimousResolveDns", () => {
  it("returns records that are visible from all resolvers for TXT", async () => {
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

  it("returns records that are visible from all resolvers for non-TXT", async () => {
    const resolveDns = createUnanimousResolveDns([
      createMockResolveDns({
        A: ["1.1.1.1", "8.8.8.8"],
        AAAA: [],
        NS: [],
        TXT: [],
      }),
      createMockResolveDns({
        A: ["8.8.8.8", "9.9.9.9"],
        AAAA: [],
        NS: [],
        TXT: [],
      }),
    ]);

    await expect(resolveDns("example.com", "A")).resolves.toEqual([
      "8.8.8.8",
    ]);
  });

  it("throws when no resolvers are provided", () => {
    expect(() => createUnanimousResolveDns([])).toThrow(
      "Expected at least 1 resolver",
    );
  });
});
