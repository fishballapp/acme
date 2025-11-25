import { getAlgorithmProperties, type KeyPairAlgorithm } from "../utils/crypto.ts";
import { extractFirstPemObject } from "../utils/pem.ts";

async function derivePublicKey(
  privateKey: CryptoKey,
  keyPairAlgorithm: KeyPairAlgorithm = "ec",
): Promise<CryptoKey> {
  // d contains the private info of the key
  const { d: _discardedPrivateInfo, ...jwkPublic } = {
    ...await crypto.subtle.exportKey("jwk", privateKey),
    key_ops: ["verify"],
  };

  // Import the modified JWK as a public key
  return crypto.subtle.importKey(
    "jwk",
    jwkPublic,
    getAlgorithmProperties(keyPairAlgorithm),
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
    publicKey: await derivePublicKey(privateKey, keyPairAlgorithm),
  };
}
