/**
 * @module
 *
 * Utility function to generate a Certificate Signing Request (CSR) in DER format
 */

import { Asn1Encoder } from "../Asn1/Asn1Encoder.ts";
import { splitAtIndex } from "./array.ts";
import {
  getKeyAlgorithmFamily,
  type KeyAlgorithmFamily,
  sign,
} from "./crypto.ts";

const OIDS = {
  COMMON_NAME: "2.5.4.3",
  SUBJECT_ALT_NAME: "2.5.29.17",
  ECDSA_WITH_SHA256: "1.2.840.10045.4.3.2",
  RSA_WITH_SHA256: "1.2.840.113549.1.1.11",
  EXTENSION_REQUEST: "1.2.840.113549.1.9.14",
} as const;

/**
 * Per-family encoding of the CSR `signatureAlgorithm` field and of the raw
 * signature WebCrypto produces. The family is derived from the signing key
 * (see {@link getKeyAlgorithmFamily}), so the CSR always matches its key.
 *
 * - `ec`: ECDSA-with-SHA-256 with absent parameters (RFC 5758 §3.2). WebCrypto
 *   returns the raw `r‖s` pair, which X.509 wraps as `SEQUENCE { r, s }`
 *   (RFC 3279 §2.2.3).
 * - `rsa`: sha256WithRSAEncryption whose parameters MUST be explicit NULL
 *   (RFC 4055 §5); the PKCS#1 v1.5 signature is carried verbatim.
 */
const CSR_SIGNATURE_STRATEGY: Record<KeyAlgorithmFamily, {
  signatureAlgorithm: Uint8Array<ArrayBuffer>;
  encodeSignatureValue: (
    signature: Uint8Array<ArrayBuffer>,
  ) => Uint8Array<ArrayBuffer>;
}> = {
  ec: {
    signatureAlgorithm: Asn1Encoder.sequence(
      Asn1Encoder.oid(OIDS.ECDSA_WITH_SHA256),
    ),
    encodeSignatureValue: (signature) => {
      const [r, s] = splitAtIndex(signature, signature.byteLength / 2);
      return Asn1Encoder.sequence(
        Asn1Encoder.uintBytes(r),
        Asn1Encoder.uintBytes(s),
      );
    },
  },
  rsa: {
    signatureAlgorithm: Asn1Encoder.sequence(
      Asn1Encoder.oid(OIDS.RSA_WITH_SHA256),
      Asn1Encoder.null(),
    ),
    encodeSignatureValue: (signature) => signature,
  },
};

/**
 * Generate a Certificate Signing Request (CSR) in DER format.
 *
 * The signature scheme (ECDSA or RSASSA-PKCS1-v1_5) is derived from `keyPair`
 * itself, so the CSR always matches the key it is built from.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc2986
 */
export async function generateCSR(
  { domains, keyPair }: { domains: readonly string[]; keyPair: CryptoKeyPair },
): Promise<Uint8Array<ArrayBuffer>> {
  const { signatureAlgorithm, encodeSignatureValue } =
    CSR_SIGNATURE_STRATEGY[getKeyAlgorithmFamily(keyPair.privateKey)];

  const certificationRequestInfoSequence = encodeCertificationRequestInfo(
    {
      domains,
      subjectPKInfo: new Uint8Array<ArrayBuffer>(
        await crypto.subtle.exportKey("spki", keyPair.publicKey),
      ),
    },
  );
  /**
   * CertificationRequest ::= SEQUENCE {
   *     certificationRequestInfo CertificationRequestInfo,
   *     signatureAlgorithm AlgorithmIdentifier{{ SignatureAlgorithms }},
   *     signature          BIT STRING
   * }
   *
   * @see https://datatracker.ietf.org/doc/html/rfc2986#page-7
   */
  return Asn1Encoder.sequence(
    // certificationRequestInfo
    certificationRequestInfoSequence,
    // signatureAlgorithm
    signatureAlgorithm,
    // signature
    Asn1Encoder.bitString(
      encodeSignatureValue(
        await sign(keyPair.privateKey, certificationRequestInfoSequence),
      ),
    ),
  );
}

function encodeCertificationRequestInfo(
  { domains, subjectPKInfo }: {
    domains: readonly string[];
    subjectPKInfo: Uint8Array<ArrayBuffer>;
  },
): Uint8Array<ArrayBuffer> {
  const [mainDomain] = domains;
  if (mainDomain === undefined) {
    throw new Error("no domain given to generate csr");
  }

  /**
   * CertificationRequestInfo ::= SEQUENCE {
   *      version       INTEGER { v1(0) } (v1,...),
   *      subject       Name,
   *      subjectPKInfo SubjectPublicKeyInfo{{ PKInfoAlgorithms }},
   *      attributes    [0] Attributes{{ CRIAttributes }}
   * }
   * @see https://datatracker.ietf.org/doc/html/rfc2986#section-4
   */
  return Asn1Encoder.sequence(
    // version
    Asn1Encoder.uint(0),
    // subject
    Asn1Encoder.sequence(
      Asn1Encoder.set(
        Asn1Encoder.sequence(
          Asn1Encoder.oid(OIDS.COMMON_NAME),
          Asn1Encoder.utf8String(mainDomain),
        ),
      ),
    ),
    // subjectPKInfo
    subjectPKInfo,
    // attributes
    Asn1Encoder.custom(
      0xA0, // Tag: [0].
      Asn1Encoder.sequence(
        Asn1Encoder.oid(OIDS.EXTENSION_REQUEST),
        Asn1Encoder.set(
          Asn1Encoder.sequence(
            encodeSubjectAlternativeName(domains),
          ),
        ),
      ),
    ),
  );
}

const encodeSubjectAlternativeName = (() => {
  /**
   * These tags are specific for X.509 > SAN > GENERAL_NAME
   * @see https://datatracker.ietf.org/doc/html/rfc5280#section-4.2.1.6 SAN
   * @see https://datatracker.ietf.org/doc/html/rfc5280#page-38 Definition for GENERAL_NAME
   */
  const GENERAL_NAME_TAGS = {
    DNS_NAME: 0x82,
  };

  return (
    domains: readonly string[],
  ): Uint8Array<ArrayBuffer> => {
    return Asn1Encoder.sequence(
      Asn1Encoder.oid(OIDS.SUBJECT_ALT_NAME),
      Asn1Encoder.octetString(
        Asn1Encoder.sequence(
          ...domains.map((domain) =>
            Asn1Encoder.custom(
              GENERAL_NAME_TAGS.DNS_NAME, // i think that's the tag to use for "DNS:"
              new TextEncoder().encode(domain),
            )
          ),
        ),
      ),
    );
  };
})();
