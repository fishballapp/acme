import { extractFirstPemObject } from "../utils/pem.ts";

async function derivePublicKey(privateKey: CryptoKey): Promise<CryptoKey> {
  // d contains the private info of the key
  const { d: _discardedPrivateInfo, ...jwkPublic } = {
    ...await crypto.subtle.exportKey("jwk", privateKey),
    key_ops: ["verify"],
  };

  // Import the modified JWK as a public key
  return crypto.subtle.importKey(
    "jwk",
    jwkPublic,
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["verify"],
  );
}

/**
 * Import the private key in PEM format, derive its public key and return the `Promise<CryptoKeyPair>`.
 */
export async function importKeyPairFromPemPrivateKey(
  pemPrivateKey: string,
): Promise<CryptoKeyPair> {
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    extractFirstPemObject(pemPrivateKey) as BufferSource,
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign"],
  );

  return {
    privateKey,
    publicKey: await derivePublicKey(privateKey),
  };
}
