import { decodeSequence, decodeTime } from "../Asn1/Asn1DecodeHelpers.ts";

const getLeafCertificateBase64 = (pem: string): Uint8Array => {
  return Uint8Array.from(
    [
      ...atob(
        pem.replace("-----BEGIN CERTIFICATE-----", "")
          .replace(/-----END CERTIFICATE-----.*/s, "")
          .replaceAll(/\s/g, ""),
      ),
    ].map((c) => c.charCodeAt(0)),
  );
};

export const decodeValidity = (certPem: string): {
  notBefore: Date;
  notAfter: Date;
} => {
  const leaf = getLeafCertificateBase64(certPem);

  /**
   * Leaf ASN.1
   *
   * Certificate  ::=  SEQUENCE  {
   *    tbsCertificate       TBSCertificate,
   *    signatureAlgorithm   AlgorithmIdentifier,
   *    signatureValue       BIT STRING
   * }
   *
   * TBSCertificate  ::=  SEQUENCE  {
   *    version         [0]  EXPLICIT Version DEFAULT v1,
   *    serialNumber         CertificateSerialNumber,
   *    signature            AlgorithmIdentifier,
   *    issuer               Name,
   *    validity             Validity,
   *    ...
   * }
   *
   * Validity ::= SEQUENCE {
   *    notBefore      Time,
   *    notAfter       Time
   * }
   *
   * Time ::= CHOICE {
   *    utcTime        UTCTime,
   *    generalTime    GeneralizedTime
   * }
   *
   * @see https://datatracker.ietf.org/doc/html/rfc5280#section-4.1
   */

  const [tbsCertificate] = decodeSequence(leaf);
  if (tbsCertificate === undefined) {
    throw new Error("cannot find tbs cert");
  }

  const [_version, _serialNumber, _signature, _issuer, validity] =
    decodeSequence(tbsCertificate);

  if (validity === undefined) {
    throw new Error("cannot find validity in tbs cert");
  }

  const [notBefore, notAfter] = decodeSequence(validity);
  if (notBefore === undefined || notAfter === undefined) {
    throw new Error(
      "cannot find notBefore and notAfter in the validity of the tbs cert",
    );
  }

  return {
    notBefore: decodeTime(notBefore),
    notAfter: decodeTime(notAfter),
  };
};
