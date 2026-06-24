import { describe, expect, it } from "../../test_deps.ts";
import { decodeBase64Url } from "./base64.ts";
import { generateKeyPair } from "./crypto.ts";
import { jws } from "./jws.ts";

const decodeProtectedHeader = (protectedHeader: string) =>
  JSON.parse(new TextDecoder().decode(decodeBase64Url(protectedHeader)));

describe("jws", () => {
  it("should pick ES256 for EC keys and RS256 for RSA keys", async () => {
    for (
      const [algorithm, expectedAlg] of [
        ["ec", "ES256"],
        ["rsa-2048", "RS256"],
      ] as const
    ) {
      const { privateKey } = await generateKeyPair(algorithm);
      const { protected: protectedHeader } = await jws(privateKey, {
        protected: { url: "https://example.com" },
        payload: { hello: "world" },
      });

      expect(decodeProtectedHeader(protectedHeader).alg).toBe(expectedAlg);
    }
  });

  it("should let an explicit alg in the protected header win", async () => {
    // External Account Binding signs the account key with an HMAC key + HS256,
    // which has no EC/RSA family. The explicit alg must be used as-is.
    const hmacKey = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(32),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );

    const { protected: protectedHeader } = await jws(hmacKey, {
      protected: { alg: "HS256", url: "https://example.com" },
      payload: { hello: "world" },
    });

    expect(decodeProtectedHeader(protectedHeader).alg).toBe("HS256");
  });

  it("should produce a signature that verifies against the public key", async () => {
    for (
      const [algorithm, verifyParams] of [
        ["ec", { name: "ECDSA", hash: "SHA-256" }],
        ["rsa-2048", { name: "RSASSA-PKCS1-v1_5" }],
      ] as const
    ) {
      const { privateKey, publicKey } = await generateKeyPair(algorithm);
      const result = await jws(privateKey, {
        protected: { url: "https://example.com" },
        payload: { hello: "world" },
      });

      const verified = await crypto.subtle.verify(
        verifyParams,
        publicKey,
        decodeBase64Url(result.signature),
        new TextEncoder().encode(`${result.protected}.${result.payload}`),
      );

      expect(verified).toBe(true);
    }
  });
});
