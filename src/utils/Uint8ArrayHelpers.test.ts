import { describe, expect, it } from "../../test_deps.ts";
import { isEqualUint8Arrays, uint8ArrayToNumber } from "./Uint8ArrayHelpers.ts";

describe("uint8ArrayToNumber", () => {
  it("should decode an uint8array into a number", () => {
    expect(
      uint8ArrayToNumber(Uint8Array.from([0x1F, 0xF9])),
    ).toBe(0x1FF9);

    expect(
      uint8ArrayToNumber(Uint8Array.from([0x1, 0xFF])),
    ).toBe(0x1FF);
  });
});

describe("isEqualUint8Arrays", () => {
  it("should return true for arrays with the same content", () => {
    expect(
      isEqualUint8Arrays(
        Uint8Array.from([1, 2, 3]),
        Uint8Array.from([1, 2, 3]),
      ),
    ).toBe(true);
    expect(isEqualUint8Arrays(new Uint8Array(0), new Uint8Array(0))).toBe(true);
  });

  it("should return false when the content differs", () => {
    expect(
      isEqualUint8Arrays(
        Uint8Array.from([1, 2, 3]),
        Uint8Array.from([1, 2, 4]),
      ),
    ).toBe(false);
  });

  it("should return false when the lengths differ", () => {
    expect(
      isEqualUint8Arrays(Uint8Array.from([1, 2, 3]), Uint8Array.from([1, 2])),
    ).toBe(false);
  });
});
