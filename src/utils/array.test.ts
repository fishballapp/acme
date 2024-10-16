import { describe, expect, it } from "../../test_deps.ts";
import { splitAtIndex } from "./array.ts";

describe("splitAtIndex", () => {
  it("should split an arry into 2 parts at given index", () => {
    expect(
      splitAtIndex([1, 2, 3], 1),
    ).toEqual([
      [1],
      [2, 3],
    ]);
  });

  it("should retain the array type", () => {
    expect(
      splitAtIndex(Uint8Array.of(1, 2, 3), 1),
    ).toEqual([
      Uint8Array.of(1),
      Uint8Array.of(2, 3),
    ]);
  });
});
