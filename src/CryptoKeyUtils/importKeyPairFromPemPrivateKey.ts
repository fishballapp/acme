import { decodeSequence } from "../Asn1/Asn1DecodeHelpers.ts";
import { Asn1Encoder } from "../Asn1/Asn1Encoder.ts";
import { WEB_CRYPTO_ALGORITHM_NAME_BY_FAMILY } from "../utils/crypto.ts";
import { omit } from "../utils/object.ts";
import { extractFirstPemObject } from "../utils/pem.ts";
import { isEqualUint8Arrays } from "../utils/Uint8ArrayHelpers.ts";

// JWK members that carry private key material. EC private keys expose `d`;
// RSA private keys additionally expose the CRT values p, q, dp, dq, qi and —
// for multi-prime keys — oth (RFC 7518 §6.3.2).
const PRIVATE_JWK_MEMBERS = ["d", "p", "q", "dp", "dq", "qi", "oth"] as const;

// The DER-encoded AlgorithmIdentifier OIDs a PKCS#8 blob can declare
// (RFC 3279): rsaEncryption, id-ecPublicKey and the P-256 curve.
const OID_DER = {
  RSA_ENCRYPTION: Asn1Encoder.oid("1.2.840.113549.1.1.1"),
  ID_EC_PUBLIC_KEY: Asn1Encoder.oid("1.2.840.10045.2.1"),
  PRIME256V1: Asn1Encoder.oid("1.2.840.10045.3.1.7"),
} as const;

/**
 * Read the WebCrypto import parameters off the PKCS#8 blob itself, so callers
 * never have to say what kind of key their PEM contains.
 *
 * PKCS#8 (RFC 5208 §5) is `SEQUENCE { version, privateKeyAlgorithm
 * AlgorithmIdentifier, privateKey, ... }`, and the AlgorithmIdentifier is
 * `SEQUENCE { algorithm OID, parameters }` — for EC keys, `parameters` is the
 * named-curve OID.
 */
function getImportParameters(
  pkcs8Der: Uint8Array<ArrayBuffer>,
): EcKeyImportParams | RsaHashedImportParams {
  const [, algorithmIdentifierDer] = decodeSequence(pkcs8Der);
  if (algorithmIdentifierDer === undefined) {
    throw new Error(
      "Malformed PKCS#8 private key: missing privateKeyAlgorithm.",
    );
  }
  const [algorithmDer, parametersDer] = decodeSequence(algorithmIdentifierDer);
  if (algorithmDer === undefined) {
    throw new Error("Malformed PKCS#8 private key: empty AlgorithmIdentifier.");
  }

  if (isEqualUint8Arrays(algorithmDer, OID_DER.RSA_ENCRYPTION)) {
    // The hash is not part of the key; SHA-256 matches the `RS256` JWS alg
    // and `sha256WithRSAEncryption` CSR signature this client produces.
    return { name: WEB_CRYPTO_ALGORITHM_NAME_BY_FAMILY.rsa, hash: "SHA-256" };
  }

  if (isEqualUint8Arrays(algorithmDer, OID_DER.ID_EC_PUBLIC_KEY)) {
    if (
      parametersDer === undefined ||
      !isEqualUint8Arrays(parametersDer, OID_DER.PRIME256V1)
    ) {
      throw new Error(
        "Unsupported EC curve in PEM private key. Only P-256 (prime256v1) is supported.",
      );
    }
    return {
      name: WEB_CRYPTO_ALGORITHM_NAME_BY_FAMILY.ec,
      namedCurve: "P-256",
    };
  }

  throw new Error(
    "Unsupported algorithm in PEM private key. Expected an EC (P-256) or RSA key.",
  );
}

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
    // it, regardless of what kind of key the PEM contained.
    privateKey.algorithm,
    true,
    ["verify"],
  );
}

/**
 * Import the private key in PEM (PKCS#8) format, derive its public key and
 * return the `Promise<CryptoKeyPair>`. The key's algorithm (EC P-256 or RSA)
 * is detected from the PEM itself.
 */
export async function importKeyPairFromPemPrivateKey(
  pemPrivateKey: string,
): Promise<CryptoKeyPair> {
  const pkcs8Der = extractFirstPemObject(pemPrivateKey);

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8Der,
    getImportParameters(pkcs8Der),
    true,
    ["sign"],
  );

  return {
    privateKey,
    publicKey: await derivePublicKey(privateKey),
  };
}
