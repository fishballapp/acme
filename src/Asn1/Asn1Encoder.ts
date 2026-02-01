import {
  concatUint8Arrays,
  unsignedIntegerToUint8Array,
} from "../utils/Uint8ArrayHelpers.ts";
import { ASN1_TAGS } from "./Asn1.ts";

export const Asn1Encoder = {
  custom: (tag: number, value: Uint8Array<ArrayBuffer>) => {
    return concatUint8Arrays(
      [tag],
      Asn1Encoder.length(value.byteLength),
      value,
    );
  },

  oid: (oid: string): Uint8Array<ArrayBuffer> => {
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
    return Asn1Encoder.custom(
      ASN1_TAGS.OID,
      concatUint8Arrays([firstByte], restBytes),
    );
  },

  bitString: (bitString: Uint8Array<ArrayBuffer>) => {
    // assume bitString is always aligned octets, so we need 0 unused bits
    const unusedBits = 0;
    const data = concatUint8Arrays(
      Uint8Array.of(unusedBits),
      bitString,
    );
    return Asn1Encoder.custom(ASN1_TAGS.BITSTRING, data);
  },

  uintBytes: (bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> => {
    if (bytes[0] === undefined) {
      throw new Error(
        "Try to encode integer but no value in Uint8Array<ArrayBuffer>",
      );
    }

    // Add leading zero byte if the most significant bit is 1 so it's not mistaken as negative number!
    if (bytes[0] & 0b1000_0000) {
      bytes = concatUint8Arrays([0x00], bytes);
    }
    return Asn1Encoder.custom(ASN1_TAGS.INTEGER, bytes);
  },

  uint: (n: number) => {
    if (n < 0) {
      throw new Error("expecting positive number");
    }

    if (!Number.isInteger(n)) {
      throw new Error("Input value is not an integer.");
    }

    return Asn1Encoder.uintBytes(unsignedIntegerToUint8Array(n));
  },

  sequence: (...values: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> =>
    Asn1Encoder.custom(ASN1_TAGS.SEQUENCE, concatUint8Arrays(...values)),

  utf8String: (str: string): Uint8Array<ArrayBuffer> =>
    Asn1Encoder.custom(ASN1_TAGS.UTF8_STRING, new TextEncoder().encode(str)),

  length: (length: number): Uint8Array<ArrayBuffer> => {
    if (length < 128) {
      return Uint8Array.of(length);
    }

    const lengthBytes = unsignedIntegerToUint8Array(length);

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

  octetString: (value: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> =>
    Asn1Encoder.custom(ASN1_TAGS.OCTET_STRING, value),

  set: (value: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> =>
    Asn1Encoder.custom(ASN1_TAGS.SET, value),
};
