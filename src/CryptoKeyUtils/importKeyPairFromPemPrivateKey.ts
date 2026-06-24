import {
  getAlgorithmProperties,
  type KeyPairAlgorithm,
} from "../utils/crypto.ts";
import { omit } from "../utils/object.ts";
import { extractFirstPemObject } from "../utils/pem.ts";

// JWK members that carry private key material. EC private keys expose `d`; RSA
// private keys additionally expose the CRT values p, q, dp, dq and qi.
const PRIVATE_JWK_MEMBERS = ["d", "p", "q", "dp", "dq", "qi"] as const;

async function derivePublicKey(privateKey: CryptoKey): Promise<CryptoKey> {
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);

  return crypto.subtle.importKey(
    "jwk",
    {
      ...omit(jwk, PRIVATE_JWK_MEMBERS),
      // The exported JWK inherits the private key's `key_ops` (`["sign"]`).
      // WebCrypto rejects a JWK whose `key_ops` is inconsistent with the
      // requested usages (RFC 7517 §4.3), so set it to the public op.
      key_ops: ["verify"],
    },
    // Reuse the private key's own algorithm so the public key always matches
    // it, regardless of which KeyPairAlgorithm was requested.
    privateKey.algorithm,
    true,
    ["verify"],
  );
}

/**
 * Import the private key in PEM format, derive its public key and return the `Promise<CryptoKeyPair>`.
 */
export async function importKeyPairFromPemPrivateKey(
  pemPrivateKey: string,
  keyPairAlgorithm: KeyPairAlgorithm = "ec",
): Promise<CryptoKeyPair> {
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    extractFirstPemObject(pemPrivateKey),
    getAlgorithmProperties(keyPairAlgorithm),
    true,
    ["sign"],
  );

  return {
    privateKey,
    publicKey: await derivePublicKey(privateKey),
  };
}
