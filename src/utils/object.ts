/**
 * Return a shallow copy of `obj` with the given `keys` removed.
 *
 * Useful for deriving a public JWK from a private one by dropping the private
 * members without mutating the original object.
 */
export const omit = <T extends object, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Omit<T, K> => {
  const result = { ...obj };
  for (const key of keys) {
    delete (result as Partial<T>)[key];
  }
  return result;
};
