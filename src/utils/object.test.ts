import { describe, expect, it } from "../../test_deps.ts";
import { omit } from "./object.ts";

describe("omit", () => {
  it("should remove the given keys", () => {
    expect(omit({ a: 1, b: 2, c: 3 }, ["a", "c"])).toEqual({ b: 2 });
  });

  it("should ignore keys that are not present", () => {
    expect(omit({ a: 1 } as { a: number; b?: number }, ["b"])).toEqual({
      a: 1,
    });
  });

  it("should return an empty object when all keys are removed", () => {
    expect(omit({ a: 1, b: 2 }, ["a", "b"])).toEqual({});
  });

  it("should not mutate the original object", () => {
    const original = { a: 1, b: 2 };
    omit(original, ["a"]);
    expect(original).toEqual({ a: 1, b: 2 });
  });
});
