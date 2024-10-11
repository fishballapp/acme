const uintToBinary = (n: number) => {
  if (n < 0 || !Number.isInteger(n)) {
    throw new Error("expect unsigned integer!");
  }

  const bytes: number[] = [];
  let temp = n;
  do {
    bytes.unshift(temp & 0b1111_1111); // Extract the least significant octet
    temp >>= 8; // Remove the least significant byte
  } while (temp > 0);

  return Uint8Array.from(bytes);
};

const concatUint8Arrays = (
  ...xss: readonly ArrayLike<number>[]
): Uint8Array => {
  const totalLength = xss.reduce((acc, { length }) => acc + length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of xss) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
};

const TAGS = {
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

export const ASN1 = {
  encode: (tag: number, value: Uint8Array) => {
    return concatUint8Arrays([tag], ASN1.encodeLength(value.byteLength), value);
  },

  encodeOID: (oid: string): Uint8Array => {
    const [oidPart1, oidPart2, ...rest] = oid.split(".").map(Number);
    if (oidPart1 === undefined || oidPart2 === undefined) {
      throw new Error("oid does not contain part 1 or 2");
    }

    const firstByte = oidPart1 * 40 + oidPart2;
    const restBytes: number[] = [];
    for (const num of rest) {
      let n = num;
      const tmp = [];
      do {
        tmp.unshift(n & 0b0111_1111);
        n >>= 7;
      } while (n > 0);
      for (const [i, x] of tmp.slice(0, -1).entries()) {
        tmp[i] = x | 0x80;
      }
      restBytes.push(...tmp);
    }
    return ASN1.encode(
      TAGS.OID,
      concatUint8Arrays([firstByte], restBytes),
    );
  },

  encodeBitString: (bitString: Uint8Array) => {
    // assume bitString is always aligned octets, so we need 0 unused bits
    const unusedBits = 0;
    const data = Uint8Array.from([unusedBits, ...bitString]);
    return ASN1.encode(TAGS.BITSTRING, data);
  },

  encodeUintBytes: (bytes: Uint8Array): Uint8Array => {
    if (bytes[0] === undefined) {
      throw new Error("Try to encode integer but no value in Uint8Array");
    }

    // Add leading zero byte if the most significant bit is 1 so it's not mistaken as negative number!
    if (bytes[0] & 0b1000_0000) {
      bytes = concatUint8Arrays([0x00], bytes);
    }
    return ASN1.encode(TAGS.INTEGER, bytes);
  },

  encodeUint: (n: number) => {
    if (n < 0) {
      throw new Error("expecting positive number");
    }

    if (!Number.isInteger(n)) {
      throw new Error("Input value is not an integer.");
    }

    return ASN1.encodeUintBytes(uintToBinary(n));
  },

  encodeSequence: (...values: Uint8Array[]): Uint8Array =>
    ASN1.encode(TAGS.SEQUENCE, concatUint8Arrays(...values)),

  encodeUTF8String: (str: string): Uint8Array =>
    ASN1.encode(TAGS.UTF8, new TextEncoder().encode(str)),

  encodeLength: (length: number): Uint8Array => {
    if (length < 128) {
      return Uint8Array.from([length]);
    }

    const lengthBytes = uintToBinary(length);

    if (lengthBytes.length > 127) {
      throw new Error(
        "it requires more than 127 bytes to encode the length which is not supported by ASN.1",
      );
    }

    return concatUint8Arrays(
      // set leading bit to 1 to signify multiple length parts
      [0b1000_0000 | lengthBytes.length],
      lengthBytes,
    );
  },

  encodeOctetString: (value: Uint8Array): Uint8Array =>
    ASN1.encode(TAGS.OCTET_STRING, value),

  encodeSet: (value: Uint8Array): Uint8Array => ASN1.encode(TAGS.SET, value),
};
