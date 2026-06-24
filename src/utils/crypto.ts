import { decodeBase64Url } from "./base64.ts";

/**
 * The key algorithm used for an account's keys and the certificate keys it
 * mints.
 *
 * - `ec`: ECDSA on the NIST P-256 curve (signed as `ES256`). The default.
 * - `rsa-2048`: RSASSA-PKCS1-v1_5 with a 2048-bit modulus (signed as `RS256`).
 * - `rsa-4096`: as `rsa-2048`, but with a 4096-bit modulus.
 */
export type KeyPairAlgorithm = "ec" | "rsa-2048" | "rsa-4096";

/**
 * The signature-scheme family of a key. The RSA variants sign and encode
 * identically (only the modulus size differs), so they collapse into one
 * family for the purposes of JWS and CSR encoding.
 */
export type KeyAlgorithmFamily = "ec" | "rsa";

/**
 * The RSA public exponent F4 (65537), as the big-endian byte array WebCrypto
 * expects (`0x010001` = 65537). F4 is the standard exponent for RSA keys
 * (NIST SP 800-56B Rev. 2 §6.2).
 */
const RSA_PUBLIC_EXPONENT = new Uint8Array([0x01, 0x00, 0x01]);

/** The WebCrypto `algorithm.name` reported by each key family. */
const ALGORITHM_NAME = {
  ec: "ECDSA",
  rsa: "RSASSA-PKCS1-v1_5",
} as const;

/**
 * Map a {@link KeyPairAlgorithm} to the WebCrypto parameters used to generate
 * or import it.
 */
const ALGORITHM_PROPERTIES: Record<
  KeyPairAlgorithm,
  EcKeyGenParams | RsaHashedKeyGenParams
> = {
  "ec": {
    name: ALGORITHM_NAME.ec,
    namedCurve: "P-256",
  },
  "rsa-2048": {
    name: ALGORITHM_NAME.rsa,
    modulusLength: 2048,
    publicExponent: RSA_PUBLIC_EXPONENT,
    hash: { name: "SHA-256" },
  },
  "rsa-4096": {
    name: ALGORITHM_NAME.rsa,
    modulusLength: 4096,
    publicExponent: RSA_PUBLIC_EXPONENT,
    hash: { name: "SHA-256" },
  },
};

/** Map a key's reported WebCrypto `algorithm.name` back to its family. */
const FAMILY_BY_ALGORITHM_NAME: Record<string, KeyAlgorithmFamily> = {
  [ALGORITHM_NAME.ec]: "ec",
  [ALGORITHM_NAME.rsa]: "rsa",
};

export function getAlgorithmProperties(
  keyPairAlgorithm: KeyPairAlgorithm,
): EcKeyGenParams | RsaHashedKeyGenParams {
  return ALGORITHM_PROPERTIES[keyPairAlgorithm];
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
 *
 * @throws if the key uses an algorithm this client does not support.
 */
export function getKeyAlgorithmFamily(key: CryptoKey): KeyAlgorithmFamily {
  const family = FAMILY_BY_ALGORITHM_NAME[key.algorithm.name];
  if (family === undefined) {
    throw new Error(
      `Unsupported key algorithm "${key.algorithm.name}". Expected one of: ${
        Object.keys(FAMILY_BY_ALGORITHM_NAME).join(", ")
      }.`,
    );
  }
  return family;
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
