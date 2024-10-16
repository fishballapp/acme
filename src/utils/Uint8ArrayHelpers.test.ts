import { describe, expect, it } from "../../test_deps.ts";
import { uint8ArrayToNumber } from "./Uint8ArrayHelpers.ts";

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
