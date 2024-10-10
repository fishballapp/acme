import { sign } from "./crypto.ts";

const ASN1_TAGS = {
  NONE: 0x00,
  BOOLEAN: 0x01,
  INTEGER: 0x02,
  BITSTRING: 0x03,
  OCTET_STRING: 0x04,
  OID: 0x06,
  UTF8: 0x0C,
  SEQUENCE: 0x30,
  SET: 0x31,
} as const;

const OIDS = {
  COMMON_NAME: "2.5.4.3",
  SUBJECT_ALT_NAME: "2.5.29.17",
  ID_EC_PUBLIC_KEY: "1.2.840.10045.2.1",
  PRIME256V1: "1.2.840.10045.3.1.7",
  ECDSA_WITH_SHA256: "1.2.840.10045.4.3.2",
  EXTENSION_REQUET: "1.2.840.113549.1.9.14",
} as const;

const ECDSA_WITH_SHA256_SIGNATURE_ALGOTRITHM_SEQUENCE = encodeSequence(
  encodeOID(OIDS.ECDSA_WITH_SHA256),
);

/**
 * Generate a Certificate Signing Request (CSR) in DER format.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc2986
 */
export async function generateCSR(
  { domains, keyPair }: { domains: readonly string[]; keyPair: CryptoKeyPair },
): Promise<Uint8Array> {
  const certificationRequestInfoSequence =
    await generateCertificationRequestInfoSequence({
      domains,
      keyPair,
    });

  const signatureValue = await (async () => {
    const signature = await sign(
      keyPair.privateKey,
      certificationRequestInfoSequence,
    );

    // The signature is a concatenation of r and s values
    const r = new Uint8Array(signature.slice(0, signature.byteLength / 2));
    const s = new Uint8Array(signature.slice(signature.byteLength / 2));

    return encodeBitString(encodeSequence(
      encodeIntegerBytes(r),
      encodeIntegerBytes(s),
    ));
  })();

  const certificationRequest = encodeSequence(
    certificationRequestInfoSequence,
    ECDSA_WITH_SHA256_SIGNATURE_ALGOTRITHM_SEQUENCE,
    signatureValue,
  );

  return certificationRequest;
}

async function generateCertificationRequestInfoSequence(
  { domains, keyPair }: { domains: readonly string[]; keyPair: CryptoKeyPair },
): Promise<Uint8Array> {
  const [mainDomain] = domains;
  if (mainDomain === undefined) {
    throw new Error("no domain given to generate csr");
  }

  const version = Uint8Array.from([
    ASN1_TAGS.INTEGER,
    0x01, // length: 1 byte
    0x00, // version 0
  ]);

  const attributeTypeAndValue = encodeSequence(
    encodeOID(OIDS.COMMON_NAME),
    encodeUTF8String(mainDomain),
  );

  // RelativeDistinguishedName SET
  const relativeDistinguishNameSet = encodeSet(attributeTypeAndValue);

  // RDNSequence SEQUENCE
  const subject = encodeSequence(relativeDistinguishNameSet);

  // Step 3: Encode the subject public key info

  // SubjectPublicKeyInfo SEQUENCE
  const subjectPublicKeyInfo = encodeSequence(
    // AlgorithmIdentifier SEQUENCE
    encodeSequence(
      encodeOID(OIDS.ID_EC_PUBLIC_KEY),
      encodeOID(OIDS.PRIME256V1),
    ),
    // SubjectPublicKey BIT STRING
    encodeBitString(
      new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey)),
    ),
  );

  // Step 4: Encode the attributes
  const extensionRequest = encodeSequence(
    encodeOID(OIDS.EXTENSION_REQUET),
    encodeSet(
      encodeSequence(encodeSubjectAlternativeName(domains)),
    ),
  );
  // [0] Attributes (context-specific, constructed)
  const attributes = concatUint8Arrays(
    [0xA0], // Tag: [0] constructed context-specific
    encodeLength(extensionRequest.length),
    extensionRequest,
  );

  // Step 5: Assemble the CertificationRequestInfo
  return encodeSequence(
    version,
    subject,
    subjectPublicKeyInfo,
    attributes,
  );
}

function encodeSubjectAlternativeName(domains: readonly string[]): Uint8Array {
  function encodeSanDns(str: string) {
    const strBytes = new TextEncoder().encode(str);
    const lengthBytes = encodeLength(strBytes.length);
    return concatUint8Arrays(
      [0x82], // i think that's the tag to use for "DNS:"
      lengthBytes,
      strBytes,
    );
  }

  return encodeSequence(
    concatUint8Arrays(
      encodeOID(OIDS.SUBJECT_ALT_NAME),
      encodeOctetString(
        concatUint8Arrays(
          encodeSequence(
            ...domains.map((domain) => encodeSanDns(domain)),
          ),
        ),
      ),
    ),
  );
}

// Helper function to encode ASN.1 length
function encodeLength(length: number): Uint8Array {
  if (length < 128) {
    return Uint8Array.from([length]);
  }

  const lengthBytes = [];
  let tempLength = length;
  while (tempLength > 0) {
    lengthBytes.unshift(tempLength & 0xff);
    tempLength >>= 8;
  }
  lengthBytes.unshift(0x80 | lengthBytes.length);
  return Uint8Array.from(lengthBytes);
}

// Helper function to encode ASN.1 INTEGER from bytes
function encodeIntegerBytes(bytes: Uint8Array): Uint8Array {
  if (bytes[0] === undefined) {
    throw new Error("Try to encode integer but no value in Uint8Array");
  }

  // Add leading zero byte if the first byte has the highest bit set
  if (bytes[0] & 0x80) {
    bytes = concatUint8Arrays([0x00], bytes);
  }
  const lengthBytes = encodeLength(bytes.length);
  return concatUint8Arrays([ASN1_TAGS.INTEGER], lengthBytes, bytes);
}

// Helper function to encode ASN.1 SEQUENCE
function encodeSequence(...values: Uint8Array[]): Uint8Array {
  const value = concatUint8Arrays(...values);
  const lengthBytes = encodeLength(value.length);
  return concatUint8Arrays([ASN1_TAGS.SEQUENCE], lengthBytes, value);
}

function encodeOctetString(value: Uint8Array): Uint8Array {
  const lengthBytes = encodeLength(value.length);
  return concatUint8Arrays([ASN1_TAGS.OCTET_STRING], lengthBytes, value);
}

// Helper function to encode ASN.1 SET
function encodeSet(value: Uint8Array): Uint8Array {
  const lengthBytes = encodeLength(value.length);
  return concatUint8Arrays([ASN1_TAGS.SET], lengthBytes, value);
}

// Helper function to encode ASN.1 OBJECT IDENTIFIER
function encodeOID(oid: string): Uint8Array {
  const [oidPart1, oidPart2, ...rest] = oid.split(".").map(Number);
  if (oidPart1 === undefined || oidPart2 === undefined) {
    throw new Error("oid does not contain part 1 or 2");
  }

  const firstByte = oidPart1 * 40 + oidPart2;
  const restBytes = [];
  for (const num of rest) {
    let n = num;
    const tmp = [];
    do {
      tmp.unshift(n & 0x7f);
      n >>= 7;
    } while (n > 0);
    for (const [i, x] of tmp.slice(0, -1).entries()) {
      tmp[i] = x | 0x80;
    }
    restBytes.push(...tmp);
  }
  const valueBytes = [firstByte, ...restBytes];
  const lengthBytes = encodeLength(valueBytes.length);
  return concatUint8Arrays([ASN1_TAGS.OID], lengthBytes, valueBytes);
}

// Helper function to encode ASN.1 UTF8String
function encodeUTF8String(str: string): Uint8Array {
  const utf8encoder = new TextEncoder();
  const strBytes = utf8encoder.encode(str);
  const lengthBytes = encodeLength(strBytes.length);
  return concatUint8Arrays([ASN1_TAGS.UTF8], lengthBytes, strBytes);
}

// Helper function to encode ASN.1 BIT STRING
function encodeBitString(bitString: Uint8Array) {
  // assume bitString is always aligned octets, so we need 0 unused bits
  const unusedBits = 0;
  const data = Uint8Array.from([unusedBits, ...bitString]);
  const lengthBytes = encodeLength(data.length);
  return concatUint8Arrays([ASN1_TAGS.BITSTRING], lengthBytes, data);
}

// Helper function to concatenate Uint8Arrays
function concatUint8Arrays(...xss: readonly ArrayLike<number>[]): Uint8Array {
  const totalLength = xss.reduce((acc, { length }) => acc + length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of xss) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
