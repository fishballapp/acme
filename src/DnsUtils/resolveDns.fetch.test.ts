import { afterEach, describe, expect, it } from "../../test_deps.ts";
import { resolveDns } from "./resolveDns.fetch.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("resolveDns.fetch", () => {
  it("should resolve non-TXT records using DoH answers", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({
        Status: 0,
        Answer: [{ type: 1, data: "1.2.3.4" }],
      }))) as typeof globalThis.fetch;

    await expect(resolveDns("example.com", "A")).resolves.toEqual(["1.2.3.4"]);
  });

  it("should return TXT records as chunk arrays", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({
        Status: 0,
        Answer: [{ type: 16, data: "\"hello\" \"world\"" }],
      }))) as typeof globalThis.fetch;

    await expect(resolveDns("example.com", "TXT")).resolves.toEqual([[
      "hello",
      "world",
    ]]);
  });

  it("should throw when DoH status indicates an error", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({
        Status: 3,
      }))) as typeof globalThis.fetch;

    await expect(resolveDns("example.com", "NS")).rejects.toThrow(
      "Status 3",
    );
  });
});
