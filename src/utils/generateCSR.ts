import { splitAtIndex } from "./array.ts";
import { ASN1 } from "./ASN1.ts";
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
): Promise<Uint8Array> {
  const certificationRequestInfoSequence = encodeCertificationRequestInfo(
    {
      domains,
      publicKeyDer: new Uint8Array(
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
  return ASN1.encodeSequence(
    // certificationRequestInfo
    certificationRequestInfoSequence,
    // signatureAlgorithm
    ASN1.encodeSequence(
      ASN1.encodeOID(OIDS.ECDSA_WITH_SHA256),
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
    publicKeyDer: Uint8Array;
  },
): Uint8Array {
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
  return ASN1.encodeSequence(
    // version
    ASN1.encodeUint(0),
    // subject
    ASN1.encodeSequence(
      ASN1.encodeSet(
        ASN1.encodeSequence(
          ASN1.encodeOID(OIDS.COMMON_NAME),
          ASN1.encodeUTF8String(mainDomain),
        ),
      ),
    ),
    // subjectPKInfo
    ASN1.encodeSequence(
      ASN1.encodeSequence(
        ASN1.encodeOID(OIDS.ID_EC_PUBLIC_KEY),
        ASN1.encodeOID(OIDS.PRIME256V1),
      ),
      ASN1.encodeBitString(publicKeyDer),
    ),
    // attributes
    ASN1.encode(
      0xA0, // Tag: [0].
      ASN1.encodeSequence(
        ASN1.encodeOID(OIDS.EXTENSION_REQUET),
        ASN1.encodeSet(
          ASN1.encodeSequence(
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
  ): Uint8Array => {
    return ASN1.encodeSequence(
      ASN1.encodeOID(OIDS.SUBJECT_ALT_NAME),
      ASN1.encodeOctetString(
        ASN1.encodeSequence(
          ...domains.map((domain) =>
            ASN1.encode(
              GENERAL_NAME_TAGS.DNS_NAME, // i think that's the tag to use for "DNS:"
              new TextEncoder().encode(domain),
            )
          ),
        ),
      ),
    );
  };
})();

const encodeSignatureBitString = (signature: Uint8Array): Uint8Array => {
  const [r, s] = splitAtIndex(signature, signature.byteLength / 2);

  return ASN1.encodeBitString(ASN1.encodeSequence(
    ASN1.encodeUintBytes(r),
    ASN1.encodeUintBytes(s),
  ));
};
