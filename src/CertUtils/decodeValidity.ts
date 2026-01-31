import type { AcmeOrder as _AcmeOrder } from "../AcmeOrder.ts";
import { decodeSequence, decodeTime } from "../Asn1/Asn1DecodeHelpers.ts";
import { extractFirstPemObject } from "../utils/pem.ts";

/**
 * A function to retrieve your certificate's validity time.
 *
 * This function is useful if you'd like to keep track of when the certificate starts to become valid / expires.
 *
 * @example
 * ```ts
 * import { CertUtils } from "@fishballpkg/acme";
 *
 * const certInPemFormat = new TextDecoder().decode(await Deno.readFile("my-certificate.crt"));
 *
 * const {
 *   notBefore, // You cannot use your cert before this dates.
 *   notAfter, // You cannot use your cert after this date.
 * } = CertUtils.decodeValidity(certInPemFormat);
 * ```
 *
 * @param certPem The certificate you retrieve from the ACME server. This should be in PEM format, the format you get from {@link AcmeOrder.prototype.getCertificate}.
 */
export const decodeValidity = (certPem: string): {
  notBefore: Date;
  notAfter: Date;
} => {
  const leaf = extractFirstPemObject(certPem);

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
