import { describe, expect, it } from "../test_deps.ts";
import { createResolveDns } from "./resolveDns.deno.ts";

describe("createResolveDns (Deno)", () => {
  it("returns an empty array when Deno.resolveDns reports record not found", async () => {
    const originalResolveDns = Deno.resolveDns;
    Deno.resolveDns = (() => {
      throw new Deno.errors.NotFound("no records found");
    }) as typeof Deno.resolveDns;

    try {
      const resolveDns = createResolveDns();
      await expect(resolveDns("example.com", "TXT")).resolves.toEqual([]);
    } finally {
      Deno.resolveDns = originalResolveDns;
    }
  });

  it("rethrows unexpected Deno.resolveDns failures", async () => {
    const originalResolveDns = Deno.resolveDns;
    Deno.resolveDns = (() => {
      throw new Error("resolver unavailable");
    }) as typeof Deno.resolveDns;

    try {
      const resolveDns = createResolveDns();
      await expect(resolveDns("example.com", "TXT")).rejects.toThrow(
        "resolver unavailable",
      );
    } finally {
      Deno.resolveDns = originalResolveDns;
    }
  });
});
