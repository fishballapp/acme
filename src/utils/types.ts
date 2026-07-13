/**
 * @module
 *
 * Type-level helpers vendored (with light adaptation) from
 * {@link https://github.com/sindresorhus/type-fest | type-fest} by Sindre
 * Sorhus, MIT licensed. Copied rather than depended on to keep this package
 * zero-dependency.
 */

/**
 * All keys across every member of a union.
 *
 * `keyof (A | B)` only yields the keys common to all members; this yields the
 * keys of each member by distributing over the union first.
 *
 * @see https://github.com/sindresorhus/type-fest/blob/main/source/keys-of-union.d.ts
 */
export type KeysOfUnion<Union> = Union extends unknown ? keyof Union : never;

/**
 * Widen a union so every member also declares the other members' keys as
 * `?: never`. Properties can then be read directly off the union — members
 * that lack a key type it as `undefined` instead of erroring — which makes
 * unions of structurally different shapes (e.g. `EcKeyAlgorithm |
 * RsaHashedKeyAlgorithm`) ergonomic to destructure and compare.
 *
 * @see https://github.com/sindresorhus/type-fest/blob/main/source/exclusify-union.d.ts
 */
export type ExclusifyUnion<
  Union,
  Keys extends PropertyKey = KeysOfUnion<Union>,
> = Union extends unknown
  ? Union & Partial<Record<Exclude<Keys, keyof Union>, never>>
  : never;
