import { describe, expect, it } from "../../test_deps.ts";
import { createUnanimousTxtResolveDns } from "./createUnanimousTxtResolveDns.ts";
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

describe("createUnanimousTxtResolveDns", () => {
  it("returns TXT records that are visible from all resolvers", async () => {
    const resolveDns = createUnanimousTxtResolveDns([
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

  it("delegates non-TXT records to the first resolver", async () => {
    const resolveDns = createUnanimousTxtResolveDns([
      createMockResolveDns({
        A: ["1.1.1.1"],
        AAAA: ["2001:db8::1"],
        NS: ["ns1.example.com"],
        TXT: [],
      }),
      createMockResolveDns({
        A: ["8.8.8.8"],
        AAAA: ["2001:4860:4860::8888"],
        NS: ["ns2.example.com"],
        TXT: [],
      }),
    ]);

    await expect(resolveDns("example.com", "A")).resolves.toEqual([
      "1.1.1.1",
    ]);
  });

  it("throws when no resolvers are provided", () => {
    expect(() => createUnanimousTxtResolveDns([])).toThrow(
      "Expected at least 1 resolver",
    );
  });
});
