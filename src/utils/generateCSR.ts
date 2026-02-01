/**
 * @module
 *
 * Utility function to generate a Certificate Signing Request (CSR) in DER format
 */

import { Asn1Encoder } from "../Asn1/Asn1Encoder.ts";
import { splitAtIndex } from "./array.ts";
import { sign } from "./crypto.ts";

const OIDS = {
  COMMON_NAME: "2.5.4.3",
  SUBJECT_ALT_NAME: "2.5.29.17",
  ID_EC_PUBLIC_KEY: "1.2.840.10045.2.1",
  PRIME256V1: "1.2.840.10045.3.1.7",
  ECDSA_WITH_SHA256: "1.2.840.10045.4.3.2",
  EXTENSION_REQUET: "1.2.840.113549.1.9.14",
} as const;

/**
 * Generate a Certificate Signing Request (CSR) in DER format.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc2986
 */
export async function generateCSR(
  { domains, keyPair }: { domains: readonly string[]; keyPair: CryptoKeyPair },
): Promise<Uint8Array<ArrayBuffer>> {
  const certificationRequestInfoSequence = encodeCertificationRequestInfo(
    {
      domains,
      publicKeyDer: new Uint8Array<ArrayBuffer>(
        await crypto.subtle.exportKey("raw", keyPair.publicKey),
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
    Asn1Encoder.sequence(
      Asn1Encoder.oid(OIDS.ECDSA_WITH_SHA256),
    ),
    // signature
    encodeSignatureBitString(
      await sign(keyPair.privateKey, certificationRequestInfoSequence),
    ),
  );
}

function encodeCertificationRequestInfo(
  { domains, publicKeyDer }: {
    domains: readonly string[];
    publicKeyDer: Uint8Array<ArrayBuffer>;
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
    Asn1Encoder.sequence(
      Asn1Encoder.sequence(
        Asn1Encoder.oid(OIDS.ID_EC_PUBLIC_KEY),
        Asn1Encoder.oid(OIDS.PRIME256V1),
      ),
      Asn1Encoder.bitString(publicKeyDer),
    ),
    // attributes
    Asn1Encoder.custom(
      0xA0, // Tag: [0].
      Asn1Encoder.sequence(
        Asn1Encoder.oid(OIDS.EXTENSION_REQUET),
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

const encodeSignatureBitString = (
  signature: Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer> => {
  const [r, s] = splitAtIndex(signature, signature.byteLength / 2);

  return Asn1Encoder.bitString(Asn1Encoder.sequence(
    Asn1Encoder.uintBytes(r),
    Asn1Encoder.uintBytes(s),
  ));
};
