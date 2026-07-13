import { describe, expect, it } from "../../test_deps.ts";
import {
  deriveKeyPairAlgorithm,
  generateKeyPair,
  getAlgorithmProperties,
  getKeyAlgorithmFamily,
  type KeyPairAlgorithm,
} from "./crypto.ts";

describe("getAlgorithmProperties", () => {
  it("should map ec to ECDSA P-256", () => {
    expect(getAlgorithmProperties("ec")).toEqual({
      name: "ECDSA",
      namedCurve: "P-256",
    });
  });

  it("should map rsa-2048 / rsa-4096 to RSASSA-PKCS1-v1_5 with F4", () => {
    for (
      const [algorithm, modulusLength] of [
        ["rsa-2048", 2048],
        ["rsa-4096", 4096],
      ] as const
    ) {
      const props = getAlgorithmProperties(algorithm);
      expect(props.name).toBe("RSASSA-PKCS1-v1_5");
      expect((props as RsaHashedKeyGenParams).modulusLength).toBe(
        modulusLength,
      );
      // F4 = 65537, big-endian.
      expect([...(props as RsaHashedKeyGenParams).publicExponent]).toEqual([
        0x01,
        0x00,
        0x01,
      ]);
    }
  });
});

describe("getKeyAlgorithmFamily", () => {
  it("should resolve the family from the generated key", async () => {
    for (
      const [algorithm, family] of [
        ["ec", "ec"],
        ["rsa-2048", "rsa"],
        ["rsa-4096", "rsa"],
      ] as const satisfies [KeyPairAlgorithm, string][]
    ) {
      const { privateKey, publicKey } = await generateKeyPair(algorithm);
      expect(getKeyAlgorithmFamily(privateKey)).toBe(family);
      expect(getKeyAlgorithmFamily(publicKey)).toBe(family);
    }
  });

  it("should throw for an unsupported algorithm", async () => {
    const hmacKey = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(32),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );

    expect(() => getKeyAlgorithmFamily(hmacKey)).toThrow("Unsupported");
  });
});

describe("deriveKeyPairAlgorithm", () => {
  it("should round-trip every supported algorithm", async () => {
    for (
      const algorithm of [
        "ec",
        "rsa-2048",
        "rsa-4096",
      ] as const satisfies KeyPairAlgorithm[]
    ) {
      const { privateKey, publicKey } = await generateKeyPair(algorithm);
      expect(deriveKeyPairAlgorithm(privateKey)).toBe(algorithm);
      expect(deriveKeyPairAlgorithm(publicKey)).toBe(algorithm);
    }
  });

  it("should return undefined for keys outside the supported set", async () => {
    const p384KeyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-384" },
      false,
      ["sign", "verify"],
    );

    expect(deriveKeyPairAlgorithm(p384KeyPair.privateKey)).toBe(undefined);
  });
});
