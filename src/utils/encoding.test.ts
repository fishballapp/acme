import { describe, expect, it } from "../../test_deps.ts";
import { encodeBase64, encodeBase64Url } from "./encoding.ts";

describe("encodeBase64", () => {
  it("should encode string input", () => {
    expect(encodeBase64("hello world")).toBe("aGVsbG8gd29ybGQ=");
  });

  it("should encode Uint8Array input", () => {
    const input = new TextEncoder().encode("hello world");
    expect(encodeBase64(input)).toBe("aGVsbG8gd29ybGQ=");
  });

  it("should encode ArrayBuffer input", () => {
    const input = new TextEncoder().encode("hello world").buffer;
    expect(encodeBase64(input)).toBe("aGVsbG8gd29ybGQ=");
  });
});

describe("encodeBase64Url", () => {
  it("should encode and use URL safe characters", () => {
    // Standard Base64: "++//" -> URL Safe: "--__"
    // We need input that produces + and /
    // \xff\xef -> /+8= (approx, calculation needed or trial)

    // Let's use a known vector
    // Subject: "Subject"
    // "subjects?_?" ->

    // Easier: Just test functionality using the replace logic logic implicity
    // or construct specific byte sequence.
    // 62 (+): 111110
    // 63 (/): 111111

    // Byte 1: 111110 00 -> \xF8
    // \xF8 -> +A==
    const input = new Uint8Array([0xF8]);
    // encodeBase64 would give "+A=="
    // encodeBase64Url should give "-A" (no padding)

    expect(encodeBase64Url(input)).toBe("-A");
  });

  it("should remove padding", () => {
    expect(encodeBase64Url("a")).toBe("YQ"); // "YQ==" -> "YQ"
  });

  it("should handle mixed input types like encodeBase64", () => {
    expect(encodeBase64Url("hello world")).toBe("aGVsbG8gd29ybGQ"); // "aGVsbG8gd29ybGQ=" -> ...
  });
});
