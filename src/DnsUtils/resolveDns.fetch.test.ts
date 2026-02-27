import { afterEach, describe, expect, it } from "../../test_deps.ts";
import { createResolveDnsFetch, resolveDns } from "./resolveDns.fetch.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("resolveDns.fetch", () => {
  it("should resolve non-TXT records using DoH answers", async () => {
    const mockFetch: typeof globalThis.fetch = async (_input, _init) =>
      new Response(JSON.stringify({
        Status: 0,
        Answer: [{ type: 1, data: "1.2.3.4" }],
      }));
    globalThis.fetch = mockFetch;

    await expect(resolveDns("example.com", "A")).resolves.toEqual(["1.2.3.4"]);
  });

  it("should return TXT records as chunk arrays", async () => {
    const mockFetch: typeof globalThis.fetch = async (_input, _init) =>
      new Response(JSON.stringify({
        Status: 0,
        Answer: [{ type: 16, data: "\"hello\" \"world\"" }],
      }));
    globalThis.fetch = mockFetch;

    await expect(resolveDns("example.com", "TXT")).resolves.toEqual([[
      "hello",
      "world",
    ]]);
  });

  it("should throw when DoH status indicates an error", async () => {
    const mockFetch: typeof globalThis.fetch = async (_input, _init) =>
      new Response(JSON.stringify({
        Status: 3,
      }));
    globalThis.fetch = mockFetch;

    await expect(resolveDns("example.com", "NS")).rejects.toThrow(
      "Status 3",
    );
  });

  it("should support custom DoH endpoint", async () => {
    let requestedUrl = "";
    const mockFetch: typeof globalThis.fetch = async (url) => {
      requestedUrl = `${url}`;
      return new Response(JSON.stringify({ Status: 0, Answer: [] }));
    };
    globalThis.fetch = mockFetch;

    await createResolveDnsFetch({
      endpoint: "https://example-resolver.test/dns-query",
    })("example.com", "A");

    expect(requestedUrl).toContain("example-resolver.test/dns-query");
  });
});
