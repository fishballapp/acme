import { expect, it } from "../../test_deps.ts";
import { uint8ArrayToNumber } from "../utils/Uint8ArrayHelpers.ts";
import { ASN1_TAGS } from "./Asn1.ts";
import {
  decodeSequence,
  decodeTagLengthValue,
  decodeTime,
} from "./Asn1DecodeHelpers.ts";
import { Asn1Encoder } from "./Asn1Encoder.ts";

it("should decode asn1", () => {
  const asn1Der = Asn1Encoder.sequence(
    Asn1Encoder.uint(0x55555),
    Asn1Encoder.sequence(
      Asn1Encoder.utf8String("hello world"),
    ),
  );

  const values = decodeSequence(asn1Der);
  expect(values.length).toBe(2);

  const [uintDer, subsequenceDer] = values;
  const [, , numberBinary] = decodeTagLengthValue(uintDer!);
  expect(uint8ArrayToNumber(numberBinary)).toBe(0x55555);

  const [helloWorldStringDer] = decodeSequence(subsequenceDer!);
  const [, , helloWorldStringCharCodes] = decodeTagLengthValue(
    helloWorldStringDer!,
  );

  expect(new TextDecoder().decode(helloWorldStringCharCodes)).toBe(
    "hello world",
  );
});

it("should decode utc time correctly", () => {
  expect(
    decodeTime(
      Asn1Encoder.custom(
        ASN1_TAGS.UTC_TIME,
        new TextEncoder().encode("950505055555Z"),
      ),
    ).toISOString(),
  ).toEqual("1995-05-05T05:55:55.000Z");
});

it("should decode generalized time correctly", () => {
  expect(
    decodeTime(
      Asn1Encoder.custom(
        ASN1_TAGS.UTC_TIME,
        new TextEncoder().encode("21950505055555Z"),
      ),
    ).toISOString(),
  ).toEqual("2195-05-05T05:55:55.000Z");
});
