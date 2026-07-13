import { decodeBase64Url } from "./base64.ts";
import type { ExclusifyUnion } from "./types.ts";

/**
 * Naming used throughout this module (and the modules that build on it):
 *
 * - A **key pair algorithm** ({@link KeyPairAlgorithm}, e.g. `"ec-p256"`,
 *   `"rsa-2048"`) is the full recipe for generating a key pair: a family plus
 *   its parameters (curve or modulus size). This is what users pick.
 * - Its **family** ({@link KeyPairAlgorithmFamily}: `"ec"` | `"rsa"`) is the
 *   signature scheme, which is all that JWS and CSR encoding care about.
 * - The **WebCrypto algorithm name** (`"ECDSA"`, `"RSASSA-PKCS1-v1_5"`) is
 *   what the runtime reports on `CryptoKey#algorithm.name`; it identifies the
 *   family but is spelled by the WebCrypto spec, not by us.
 *
 * Lookup tables are named `<VALUE>_BY_<KEY>`.
 */

/**
 * The RSA public exponent F4 (65537), as the big-endian byte array WebCrypto
 * expects (`0x010001` = 65537). F4 is the standard exponent for RSA keys
 * (NIST SP 800-56B Rev. 2 §6.2).
 */
const RSA_PUBLIC_EXPONENT: Uint8Array<ArrayBuffer> = new Uint8Array([
  0x01,
  0x00,
  0x01,
]);

/**
 * The WebCrypto `algorithm.name` reported by each key family. Its keys are the
 * source of truth for {@link KeyPairAlgorithmFamily}.
 */
export const WEB_CRYPTO_ALGORITHM_NAME_BY_FAMILY = {
  ec: "ECDSA",
  rsa: "RSASSA-PKCS1-v1_5",
} as const;

/**
 * The signature-scheme family of a key. The RSA variants sign and encode
 * identically (only the modulus size differs), so they collapse into one
 * family for the purposes of JWS and CSR encoding.
 */
export type KeyPairAlgorithmFamily =
  keyof typeof WEB_CRYPTO_ALGORITHM_NAME_BY_FAMILY;

/**
 * The WebCrypto parameters used to generate each supported key algorithm. Its
 * keys are the source of truth for {@link KeyPairAlgorithm}; `satisfies`
 * validates every entry without widening the literal types away.
 */
const KEY_GEN_PARAMS_BY_KEY_PAIR_ALGORITHM = {
  "ec-p256": {
    name: WEB_CRYPTO_ALGORITHM_NAME_BY_FAMILY.ec,
    namedCurve: "P-256",
  },
  "rsa-2048": {
    name: WEB_CRYPTO_ALGORITHM_NAME_BY_FAMILY.rsa,
    modulusLength: 2048,
    publicExponent: RSA_PUBLIC_EXPONENT,
    hash: "SHA-256",
  },
  "rsa-4096": {
    name: WEB_CRYPTO_ALGORITHM_NAME_BY_FAMILY.rsa,
    modulusLength: 4096,
    publicExponent: RSA_PUBLIC_EXPONENT,
    hash: "SHA-256",
  },
} as const satisfies Record<string, EcKeyGenParams | RsaHashedKeyGenParams>;

/**
 * The key algorithm used for an account's keys and the certificate keys it
 * mints.
 *
 * - `ec-p256`: ECDSA on the NIST P-256 curve (signed as `ES256`). The default.
 * - `rsa-2048`: RSASSA-PKCS1-v1_5 with a 2048-bit modulus (signed as `RS256`).
 * - `rsa-4096`: as `rsa-2048`, but with a 4096-bit modulus.
 */
export type KeyPairAlgorithm =
  keyof typeof KEY_GEN_PARAMS_BY_KEY_PAIR_ALGORITHM;

/** Map a key's reported WebCrypto `algorithm.name` back to its family. */
const FAMILY_BY_WEB_CRYPTO_ALGORITHM_NAME: Record<
  string,
  KeyPairAlgorithmFamily
> = {
  [WEB_CRYPTO_ALGORITHM_NAME_BY_FAMILY.ec]: "ec",
  [WEB_CRYPTO_ALGORITHM_NAME_BY_FAMILY.rsa]: "rsa",
};

export function getKeyGenParams(
  keyPairAlgorithm: KeyPairAlgorithm,
): EcKeyGenParams | RsaHashedKeyGenParams {
  return KEY_GEN_PARAMS_BY_KEY_PAIR_ALGORITHM[keyPairAlgorithm];
}

/**
 * Derive the {@link KeyPairAlgorithm} that would generate a key like this one,
 * or `undefined` when the key falls outside the supported set (e.g. an
 * imported RSA-3072 or P-384 key). Such keys can still sign JWS requests —
 * only key generation (certificate keys, key rollover) needs a
 * {@link KeyPairAlgorithm}.
 */
export function deriveKeyPairAlgorithm(
  key: CryptoKey,
): KeyPairAlgorithm | undefined {
  const { name, namedCurve, modulusLength } = key.algorithm as ExclusifyUnion<
    EcKeyAlgorithm | RsaHashedKeyAlgorithm
  >;

  return (Object.keys(
    KEY_GEN_PARAMS_BY_KEY_PAIR_ALGORITHM,
  ) as KeyPairAlgorithm[]).find(
    (keyPairAlgorithm) => {
      const params: ExclusifyUnion<EcKeyGenParams | RsaHashedKeyGenParams> =
        KEY_GEN_PARAMS_BY_KEY_PAIR_ALGORITHM[keyPairAlgorithm];
      // Members a family lacks are `undefined` on both sides (see
      // ExclusifyUnion), so the same equalities cover EC (namedCurve)
      // and RSA (modulusLength) alike.
      return params.name === name &&
        params.namedCurve === namedCurve &&
        params.modulusLength === modulusLength;
    },
  );
}

export async function generateKeyPair(
  keyPairAlgorithm: KeyPairAlgorithm = "ec-p256",
): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    getKeyGenParams(keyPairAlgorithm),
    true,
    ["sign", "verify"],
  );
}

/**
 * Resolve a key's {@link KeyPairAlgorithmFamily} from the key itself.
 *
 * Reading the algorithm off the {@link CryptoKey} — rather than a separately
 * passed hint that can be omitted — guarantees the JWS `alg` and the CSR
 * signature encoding can never disagree with the actual key material.
 *
 * @throws if the key uses an algorithm this client does not support.
 */
export function getKeyPairAlgorithmFamily(
  key: CryptoKey,
): KeyPairAlgorithmFamily {
  const family = FAMILY_BY_WEB_CRYPTO_ALGORITHM_NAME[key.algorithm.name];
  if (family === undefined) {
    throw new Error(
      `Unsupported key algorithm "${key.algorithm.name}". Expected one of: ${
        Object.keys(FAMILY_BY_WEB_CRYPTO_ALGORITHM_NAME).join(", ")
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
