import { describe, expect, it } from "../../test_deps.ts";
import {
  decodeBase64 as stdDecodeBase64,
  decodeBase64Url as stdDecodeBase64Url,
  encodeBase64 as stdEncodeBase64,
  encodeBase64Url as stdEncodeBase64Url,
} from "../../test_deps.ts";
import {
  decodeBase64,
  decodeBase64Url,
  encodeBase64,
  encodeBase64Url,
} from "./base64.ts";

// Deterministic byte arrays of every length 0..48, covering all
// length-mod-3 (encode) and length-mod-4 (decode) cases.
const sampleBytes = (length: number): Uint8Array =>
  Uint8Array.from({ length }, (_, i) => (i * 37 + 13) % 256);
const lengths = Array.from({ length: 49 }, (_, i) => i);

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

  it("should encode the empty input to the empty string", () => {
    expect(encodeBase64("")).toBe("");
  });

  it("should match @std/encoding across all lengths", () => {
    for (const length of lengths) {
      const bytes = sampleBytes(length);
      expect(encodeBase64(bytes)).toBe(stdEncodeBase64(bytes));
    }
  });
});

describe("decodeBase64", () => {
  it("should decode a known vector", () => {
    expect(decodeBase64("aGVsbG8gd29ybGQ=")).toEqual(
      new TextEncoder().encode("hello world"),
    );
  });

  it("should decode the empty string to the empty array", () => {
    expect(decodeBase64("")).toEqual(new Uint8Array());
  });

  it("should round-trip with encodeBase64 across all lengths", () => {
    for (const length of lengths) {
      const bytes = sampleBytes(length);
      expect(decodeBase64(encodeBase64(bytes))).toEqual(bytes);
    }
  });

  it("should match @std/encoding across all lengths", () => {
    for (const length of lengths) {
      const b64 = stdEncodeBase64(sampleBytes(length));
      expect(decodeBase64(b64)).toEqual(stdDecodeBase64(b64));
    }
  });

  it("should throw on an invalid character", () => {
    expect(() => decodeBase64("====")).toThrow();
    expect(() => decodeBase64("a")).toThrow(); // length % 4 === 1
  });
});

describe("encodeBase64Url", () => {
  it("should encode and use URL safe characters", () => {
    // Byte 0xF8 -> standard base64 "+A==" -> base64url (unpadded) "-A"
    expect(encodeBase64Url(new Uint8Array([0xF8]))).toBe("-A");
  });

  it("should remove padding", () => {
    expect(encodeBase64Url("a")).toBe("YQ"); // "YQ==" -> "YQ"
  });

  it("should handle mixed input types like encodeBase64", () => {
    expect(encodeBase64Url("hello world")).toBe("aGVsbG8gd29ybGQ");
  });

  it("should never emit padding and match @std/encoding across all lengths", () => {
    for (const length of lengths) {
      const bytes = sampleBytes(length);
      const encoded = encodeBase64Url(bytes);
      expect(encoded).not.toContain("=");
      expect(encoded).toBe(stdEncodeBase64Url(bytes));
    }
  });
});

describe("decodeBase64Url", () => {
  it("should decode a known unpadded vector", () => {
    expect(decodeBase64Url("aGVsbG8gd29ybGQ")).toEqual(
      new TextEncoder().encode("hello world"),
    );
  });

  it("should decode URL-safe characters", () => {
    expect(decodeBase64Url("-A")).toEqual(new Uint8Array([0xF8]));
  });

  it("should round-trip with encodeBase64Url across all lengths", () => {
    for (const length of lengths) {
      const bytes = sampleBytes(length);
      expect(decodeBase64Url(encodeBase64Url(bytes))).toEqual(bytes);
    }
  });

  it("should match @std/encoding across all lengths", () => {
    for (const length of lengths) {
      const b64url = stdEncodeBase64Url(sampleBytes(length));
      expect(decodeBase64Url(b64url)).toEqual(stdDecodeBase64Url(b64url));
    }
  });
});
