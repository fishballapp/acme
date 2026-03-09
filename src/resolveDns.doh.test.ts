import { describe, expect, it } from "../test_deps.ts";
import { createResolveDns } from "./resolveDns.doh.ts";

type MockFetch = (
  ...args: Parameters<typeof fetch>
) => Response | Promise<Response>;

const withMockFetch = async (
  mockFetch: MockFetch,
  fn: () => Promise<void>,
): Promise<void> => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch =
    ((...args) => Promise.resolve(mockFetch(...args))) as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

const createJsonResponse = (
  body: unknown,
  init?: ResponseInit,
): Response => {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
    status: 200,
    ...init,
  });
};

describe("createResolveDns (DoH)", () => {
  it("returns single-string TXT answers as single chunks", async () => {
    await withMockFetch(() =>
      createJsonResponse({
        Status: 0,
        Answer: [{ type: 16, data: '"value"' }],
      }), async () => {
      const resolveDns = createResolveDns({
        endpoint: "https://dns.example.test/resolve",
      });

      await expect(resolveDns("example.com", "TXT")).resolves.toEqual([[
        "value",
      ]]);
    });
  });

  it("parses TXT answers with multiple quoted chunks and escapes", async () => {
    await withMockFetch(() =>
      createJsonResponse({
        Status: 0,
        Answer: [
          { type: 16, data: '"part1" "part2"' },
          { type: 16, data: '"quo\\"ted" "slash\\\\ed" "\\032"' },
        ],
      }), async () => {
      const resolveDns = createResolveDns({
        endpoint: "https://dns.example.test/resolve",
      });

      await expect(resolveDns("example.com", "TXT")).resolves.toEqual([
        ["part1", "part2"],
        ['quo"ted', "slash\\ed", " "],
      ]);
    });
  });

  it("falls back to a single TXT chunk for unexpected unquoted data", async () => {
    await withMockFetch(() =>
      createJsonResponse({
        Status: 0,
        Answer: [{ type: 16, data: "unquoted-value" }],
      }), async () => {
      const resolveDns = createResolveDns({
        endpoint: "https://dns.example.test/resolve",
      });

      await expect(resolveDns("example.com", "TXT")).resolves.toEqual([[
        "unquoted-value",
      ]]);
    });
  });

  it("returns non-TXT answers unchanged", async () => {
    await withMockFetch(() =>
      createJsonResponse({
        Status: 0,
        Answer: [
          { type: 1, data: "1.1.1.1" },
          { type: 1, data: "8.8.8.8" },
        ],
      }), async () => {
      const resolveDns = createResolveDns({
        endpoint: "https://dns.example.test/resolve",
      });

      await expect(resolveDns("example.com", "A")).resolves.toEqual([
        "1.1.1.1",
        "8.8.8.8",
      ]);
    });
  });

  it("returns an empty array when the DoH response status is non-zero", async () => {
    await withMockFetch(() =>
      createJsonResponse({
        Status: 3,
      }), async () => {
      const resolveDns = createResolveDns({
        endpoint: "https://dns.example.test/resolve",
      });

      await expect(resolveDns("missing.example.com", "TXT")).resolves.toEqual(
        [],
      );
    });
  });

  it("throws on non-2xx HTTP responses", async () => {
    await withMockFetch(() =>
      new Response("nope", {
        status: 503,
        statusText: "Service Unavailable",
      }), async () => {
      const resolveDns = createResolveDns({
        endpoint: "https://dns.example.test/resolve",
      });

      await expect(resolveDns("example.com", "TXT")).rejects.toThrow(
        "Failed to resolve DNS for example.com (TXT): 503 Service Unavailable",
      );
    });
  });
});
