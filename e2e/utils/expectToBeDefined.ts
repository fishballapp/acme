import { expect } from "../../test_deps.ts";

export function expectToBeDefined<T>(x: T | undefined): asserts x is T {
  expect(x).toBeDefined();
}
