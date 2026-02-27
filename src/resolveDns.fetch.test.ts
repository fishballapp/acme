import { describe, expect, it } from "../test_deps.ts";
import { resolveDns } from "./resolveDns.fetch.ts";

describe("resolveDns.fetch", () => {
  it("should successfully resolve A records", async () => {
    const result = await resolveDns("google.com", "A");
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(typeof result[0]).toBe("string");
  });

  it("should successfully resolve TXT records and strip quotes", async () => {
    // We'll use a reliable domain that is known to have TXT records
    const result = await resolveDns("google.com", "TXT") as string[][];
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(Array.isArray(result[0])).toBe(true);
    expect(typeof result[0]![0]).toBe("string");
    // Google's TXT records shouldn't contain the raw quotes
    expect(result[0]![0]!.startsWith('"')).toBe(false);
  });

  it("should successfully resolve AAAA records", async () => {
    const result = await resolveDns("google.com", "AAAA");
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(typeof result[0]).toBe("string");
  });

  it("should successfully resolve NS records", async () => {
    const result = await resolveDns("google.com", "NS");
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(typeof result[0]).toBe("string");
    // NS records usually end with a dot, let's verify it looks like a domain structure
    expect(result[0]).toMatch(/.*\..*/);
  });

  it("should return empty array if no Answer is provided in response", async () => {
    const randomDomain = `this-domain-does-not-exist-${Date.now()}.com`;
    const result = await resolveDns(randomDomain, "A");
    expect(result).toEqual([]);
  });

  it("should throw if authoritative name server IP is requested", async () => {
    let error: Error | undefined;
    try {
      await resolveDns("example.com", "A", {
        nameServer: { ipAddr: "1.1.1.1" },
      });
    } catch (e) {
      error = e as Error;
    }

    expect(error).toBeDefined();
    expect(error?.message).toBe(
      "resolveDns.fetch does not support querying specific authoritative name servers. It can only query via the main DoH endpoint.",
    );
  });
});
