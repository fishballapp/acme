import { describe, expect, it } from "../test_deps.ts";
import { createResolveDns } from "./resolveDns.node.ts";

const withMockResolverResolve = async (
  mockResolve: typeof import("node:dns/promises").Resolver.prototype.resolve,
  fn: () => Promise<void>,
): Promise<void> => {
  const { Resolver } = await import("node:dns/promises");
  const originalResolve = Resolver.prototype.resolve;
  Resolver.prototype.resolve = mockResolve;
  try {
    await fn();
  } finally {
    Resolver.prototype.resolve = originalResolve;
  }
};

describe("createResolveDns (Node)", () => {
  it("returns an empty array when Node reports record not found", async () => {
    await withMockResolverResolve(() => {
      return Promise.reject(
        Object.assign(new Error("queryTxt ENODATA example.com"), {
          code: "ENODATA",
        }),
      );
    }, async () => {
      const resolveDns = createResolveDns();
      await expect(resolveDns("example.com", "TXT")).resolves.toEqual([]);
    });
  });

  it("rethrows unexpected Node resolver failures", async () => {
    await withMockResolverResolve(() => {
      return Promise.reject(
        Object.assign(new Error("queryTxt ECONNREFUSED example.com"), {
          code: "ECONNREFUSED",
        }),
      );
    }, async () => {
      const resolveDns = createResolveDns();
      await expect(resolveDns("example.com", "TXT")).rejects.toThrow(
        "queryTxt ECONNREFUSED example.com",
      );
    });
  });
});
