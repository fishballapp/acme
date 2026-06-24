import { decodeBase64Url } from "./base64.ts";

/**
 * The key algorithm used for an account's keys and the certificate keys it
 * mints.
 *
 * - `ec`: ECDSA on the NIST P-256 curve (signed as `ES256`). The default.
 * - `rsa`: RSASSA-PKCS1-v1_5 with a 2048-bit modulus (signed as `RS256`).
 * - `rsa-4096`: as `rsa`, but with a 4096-bit modulus.
 */
export type KeyPairAlgorithm = "ec" | "rsa" | "rsa-4096";

/**
 * The signature-scheme family of a key. `rsa` and `rsa-4096` sign and encode
 * identically (only the modulus size differs), so they collapse into one
 * family for the purposes of JWS and CSR encoding.
 */
export type KeyAlgorithmFamily = "ec" | "rsa";

export function getAlgorithmProperties(keyPairAlgorithm: KeyPairAlgorithm) {
  switch (keyPairAlgorithm) {
    case "ec":
      return {
        name: "ECDSA",
        namedCurve: "P-256",
      };
    case "rsa":
      return {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
        hash: { name: "SHA-256" },
      };
    case "rsa-4096":
      return {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 4096,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
        hash: { name: "SHA-256" },
      };
  }
}

export async function generateKeyPair(
  keyPairAlgorithm: KeyPairAlgorithm = "ec",
): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    getAlgorithmProperties(keyPairAlgorithm),
    true,
    ["sign", "verify"],
  );
}

/**
 * Resolve a key's {@link KeyAlgorithmFamily} from the key itself.
 *
 * Reading the algorithm off the {@link CryptoKey} — rather than a separately
 * passed hint that can be omitted — guarantees the JWS `alg` and the CSR
 * signature encoding can never disagree with the actual key material.
 */
export function getKeyAlgorithmFamily(key: CryptoKey): KeyAlgorithmFamily {
  return key.algorithm.name.startsWith("RSA") ? "rsa" : "ec";
}

/**
 * Import a CA-provided MAC key for `HS256` External Account Binding.
 *
 * The key is expected in base64url form, as recommended by RFC 8555 §7.3.4.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8555#section-7.3.4
 */
export async function importHmacKey(hmacKey: string): Promise<CryptoKey> {
  const rawKey = decodeBase64Url(hmacKey);

  // RFC 7518 §3.2: an HS256 key MUST be at least as large as the hash output
  // (256 bits / 32 bytes). A shorter key almost always means the key string
  // was mis-encoded (e.g. standard base64 instead of base64url).
  if (rawKey.length < 32) {
    throw new Error(
      `External account binding HMAC key must be at least 32 bytes for HS256, but got ${rawKey.length}. Double-check it is the base64url-encoded key your CA provided.`,
    );
  }

  return await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function sign(
  key: CryptoKey,
  data: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const signature = await crypto.subtle.sign(
    {
      name: key.algorithm.name,
      hash: "SHA-256",
    },
    key,
    data,
  );
  return new Uint8Array<ArrayBuffer>(signature);
}
