import { uint8ArrayToNumber } from "../utils/Uint8ArrayHelpers.ts";
import { ASN1_TAGS } from "./Asn1.ts";

export const decodeTagLengthValue = (
  asn1Der: Uint8Array,
): [tag: number, length: number, value: Uint8Array, tlvDer: Uint8Array] => {
  const [tag, lengthOrLengthByteCount] = asn1Der;
  const restDer = asn1Der.slice(2);
  if (tag === undefined) {
    throw new Error("Malformed ASN.1. Tag does not exist!");
  }
  if (lengthOrLengthByteCount === undefined) {
    throw new Error("Malformed ASN.1. Length does not exist!");
  }

  if (!(lengthOrLengthByteCount & 0b1000_0000)) {
    // since the msb is not 1, so it is the length itself!
    return [
      tag,
      lengthOrLengthByteCount,
      restDer.slice(0, lengthOrLengthByteCount),
      asn1Der.slice(0, 2 + lengthOrLengthByteCount),
    ];
  }

  // reset the msb to 0
  const lengthByteCount = lengthOrLengthByteCount & 0b0111_1111;

  const lengthParts = restDer.slice(0, lengthByteCount);
  const length = uint8ArrayToNumber(lengthParts);

  return [
    tag,
    length,
    restDer.slice(lengthByteCount, lengthByteCount + length),
    asn1Der.slice(0, 2 + lengthByteCount + length),
  ];
};

export const decodeTime = (utcTimeTLVDer: Uint8Array): Date => {
  const [tag, , value] = decodeTagLengthValue(utcTimeTLVDer);

  if (tag !== ASN1_TAGS.UTC_TIME && tag !== ASN1_TAGS.GENERALIZED_TIME) {
    throw new Error(
      `Expect tag to be 0x${ASN1_TAGS.UTC_TIME.toString(16)} or 0x${
        ASN1_TAGS.GENERALIZED_TIME.toString(16)
      }, but got 0x${tag.toString(16)}.`,
    );
  }

  return parseAsn1TimeString(new TextDecoder().decode(value));
};

export const decodeSequence = (sequenceTLVDer: Uint8Array): Uint8Array[] => {
  const [tag, length, sequenceValueDer] = decodeTagLengthValue(sequenceTLVDer);

  if (tag !== ASN1_TAGS.SEQUENCE) {
    throw new Error(
      `Expect tag to be 0x${ASN1_TAGS.SEQUENCE.toString(16)}, but got 0x${
        tag.toString(16)
      }.`,
    );
  }
  const values = [];
  let totalLength = 0;
  while (totalLength < length) {
    const [, , , tlvDer] = decodeTagLengthValue(
      sequenceValueDer.slice(totalLength),
    );
    values.push(tlvDer);
    totalLength += tlvDer.byteLength;
  }

  return values;
};

export const parseAsn1TimeString = (timeString: string): Date => {
  const { year, month, day, hour, minute, second = "00" } = (() => {
    // Attempt to match as UTCTime (YYMMDDHHMMSSZ or YYMMDDHHMMZ)
    const utcMatch = timeString.match(
      /^(?<year>\d{2})(?<month>\d{2})(?<day>\d{2})(?<hour>\d{2})(?<minute>\d{2})(?<second>\d{2})?Z$/,
    );

    if (utcMatch !== null) {
      const { year, month, day, hour, minute, second } = utcMatch.groups ?? {};

      if (
        year === undefined || month === undefined || day === undefined ||
        hour === undefined || minute === undefined
      ) {
        throw new Error("Invalid UTCTime format");
      }

      return {
        year: (Number.parseInt(year) < 50 ? "20" : "19") + year,
        month,
        day,
        hour,
        minute,
        second,
      };
    }

    // If not UTCTime, attempt to match as GeneralizedTime (YYYYMMDDHHMMSSZ)
    const generalizedTimeMatch = timeString.match(
      /^(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})(?<hour>\d{2})(?<minute>\d{2})(?<second>\d{2})?Z$/,
    );

    if (generalizedTimeMatch !== null) {
      const {
        year,
        month,
        day,
        hour,
        minute,
        second,
      } = generalizedTimeMatch.groups ?? {};

      if (
        year === undefined || month === undefined || day === undefined ||
        hour === undefined || minute === undefined
      ) {
        throw new Error("Invalid GeneralizedTime format");
      }

      return { year, month, day, hour, minute, second };
    }

    throw new Error("Invalid time format");
  })();

  const isoString = `${year}-${month}-${day}T${hour}:${minute}:${
    second || "00"
  }Z`;

  return new Date(isoString);
};
