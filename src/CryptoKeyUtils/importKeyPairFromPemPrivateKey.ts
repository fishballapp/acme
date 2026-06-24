import {
  getAlgorithmProperties,
  type KeyPairAlgorithm,
} from "../utils/crypto.ts";
import { extractFirstPemObject } from "../utils/pem.ts";

async function derivePublicKey(privateKey: CryptoKey): Promise<CryptoKey> {
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);

  // A public JWK must not carry private material. EC private keys expose `d`;
  // RSA private keys additionally expose the CRT values p, q, dp, dq and qi.
  for (const field of ["d", "p", "q", "dp", "dq", "qi"] as const) {
    delete jwk[field];
  }

  // Reuse the private key's own algorithm so the public key always matches it,
  // regardless of which KeyPairAlgorithm was requested.
  return crypto.subtle.importKey(
    "jwk",
    { ...jwk, key_ops: ["verify"] },
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
