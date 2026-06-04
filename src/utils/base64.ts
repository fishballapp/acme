// This file is a vendored, dependency-free copy of the base64 / base64url
// utilities from the Deno Standard Library's `@std/encoding` package. We inline
// it here (rather than importing `@std/encoding`) to keep `@fishballpkg/acme`
// zero-dependency, while still benefiting from `@std`'s well-tested code.
//
// All credit for this implementation goes to the Deno authors / `@std/encoding`.
// The original sources merged into this single file are:
//   - https://github.com/denoland/std/blob/main/encoding/base64.ts
//   - https://github.com/denoland/std/blob/main/encoding/base64url.ts
//   - https://github.com/denoland/std/blob/main/encoding/_common64.ts
//   - https://github.com/denoland/std/blob/main/encoding/_common_detach.ts
//   - https://github.com/denoland/std/blob/main/encoding/_types.ts
//
// Copyright 2018-2026 the Deno authors. MIT license.
// This module is browser compatible.

/**
 * Proxy type of `Uint8Array<ArrayBuffer>` or `Uint8Array` in TypeScript 5.7 or
 * below respectively.
 */
type Uint8Array_ = ReturnType<Uint8Array["slice"]>;

const padding = "=".charCodeAt(0);

const base64Alphabet = new TextEncoder()
  .encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");
const base64UrlAlphabet = new TextEncoder()
  .encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_");

const rBase64Alphabet = new Uint8Array(128).fill(64); // alphabet.length
base64Alphabet.forEach((byte, i) => rBase64Alphabet[byte] = i);
const rBase64UrlAlphabet = new Uint8Array(128).fill(64); // alphabet.length
base64UrlAlphabet.forEach((byte, i) => rBase64UrlAlphabet[byte] = i);

/**
 * Calculate the output size needed to encode a given input size.
 *
 * @param originalSize The size of the input buffer.
 * @returns The size of the output buffer.
 */
function calcSizeBase64(originalSize: number): number {
  return ((originalSize + 2) / 3 | 0) * 4;
}

function detach(
  buffer: Uint8Array_,
  maxSize: number,
): [Uint8Array_, number] {
  const originalSize = buffer.length;
  if (buffer.byteOffset) {
    const b = new Uint8Array(buffer.buffer);
    b.set(buffer);
    buffer = b.subarray(0, originalSize);
  }
  // deno-lint-ignore no-explicit-any
  buffer = new Uint8Array((buffer.buffer as any).transfer(maxSize));
  buffer.set(buffer.subarray(0, originalSize), maxSize - originalSize);
  return [buffer, maxSize - originalSize];
}

function encode(
  buffer: Uint8Array_,
  i: number,
  o: number,
  alphabet: Uint8Array,
  padding: number,
): number {
  i += 2;
  for (; i < buffer.length; i += 3) {
    const x = (buffer[i - 2]! << 16) | (buffer[i - 1]! << 8) | buffer[i]!;
    buffer[o++] = alphabet[x >> 18]!;
    buffer[o++] = alphabet[x >> 12 & 0x3F]!;
    buffer[o++] = alphabet[x >> 6 & 0x3F]!;
    buffer[o++] = alphabet[x & 0x3F]!;
  }
  switch (i) {
    case buffer.length + 1: {
      const x = buffer[i - 2]! << 16;
      buffer[o++] = alphabet[x >> 18]!;
      buffer[o++] = alphabet[x >> 12 & 0x3F]!;
      buffer[o++] = padding;
      buffer[o++] = padding;
      break;
    }
    case buffer.length: {
      const x = (buffer[i - 2]! << 16) | (buffer[i - 1]! << 8);
      buffer[o++] = alphabet[x >> 18]!;
      buffer[o++] = alphabet[x >> 12 & 0x3F]!;
      buffer[o++] = alphabet[x >> 6 & 0x3F]!;
      buffer[o++] = padding;
      break;
    }
  }
  return o;
}

function decode(
  buffer: Uint8Array_,
  i: number,
  o: number,
  alphabet: Uint8Array,
  padding: number,
): number {
  for (let x = buffer.length - 2; x < buffer.length; ++x) {
    if (buffer[x] === padding) {
      for (let y = x + 1; y < buffer.length; ++y) {
        if (buffer[y] !== padding) {
          throw new TypeError(
            `Cannot decode input as base64: Invalid character (${
              String.fromCharCode(buffer[y]!)
            })`,
          );
        }
      }
      buffer = buffer.subarray(0, x);
      break;
    }
  }
  if ((buffer.length - o) % 4 === 1) {
    throw new RangeError(
      `Cannot decode input as base64: Length (${
        buffer.length - o
      }), excluding padding, must not have a remainder of 1 when divided by 4`,
    );
  }

  i += 3;
  for (; i < buffer.length; i += 4) {
    const x = (getByte(buffer[i - 3]!, alphabet) << 18) |
      (getByte(buffer[i - 2]!, alphabet) << 12) |
      (getByte(buffer[i - 1]!, alphabet) << 6) |
      getByte(buffer[i]!, alphabet);
    buffer[o++] = x >> 16;
    buffer[o++] = x >> 8 & 0xFF;
    buffer[o++] = x & 0xFF;
  }
  switch (i) {
    case buffer.length + 1: {
      const x = (getByte(buffer[i - 3]!, alphabet) << 18) |
        (getByte(buffer[i - 2]!, alphabet) << 12);
      buffer[o++] = x >> 16;
      break;
    }
    case buffer.length: {
      const x = (getByte(buffer[i - 3]!, alphabet) << 18) |
        (getByte(buffer[i - 2]!, alphabet) << 12) |
        (getByte(buffer[i - 1]!, alphabet) << 6);
      buffer[o++] = x >> 16;
      buffer[o++] = x >> 8 & 0xFF;
      break;
    }
  }
  return o;
}

function getByte(char: number, alphabet: Uint8Array): number {
  const byte = alphabet[char] ?? 64;
  if (byte === 64) { // alphabet.length
    throw new TypeError(
      `Cannot decode input as base64: Invalid character (${
        String.fromCharCode(char)
      })`,
    );
  }
  return byte;
}

/**
 * Converts data into a base64-encoded string (with padding).
 *
 * @see {@link https://www.rfc-editor.org/rfc/rfc4648.html#section-4}
 *
 * @param data The data to encode.
 * @returns The base64-encoded string.
 */
export function encodeBase64(
  data: ArrayBuffer | Uint8Array | string,
): string {
  if (typeof data === "string") {
    data = new TextEncoder().encode(data) as Uint8Array_;
  } else if (data instanceof ArrayBuffer) data = new Uint8Array(data).slice();
  else data = data.slice();
  const [output, i] = detach(
    data as Uint8Array_,
    calcSizeBase64((data as Uint8Array_).length),
  );
  encode(output, i, 0, base64Alphabet, padding);
  return new TextDecoder().decode(output);
}

/**
 * Decodes a base64-encoded string.
 *
 * @see {@link https://www.rfc-editor.org/rfc/rfc4648.html#section-4}
 *
 * @param b64 The base64-encoded string to decode.
 * @returns The decoded data.
 */
export function decodeBase64(b64: string): Uint8Array<ArrayBuffer> {
  const output = new TextEncoder().encode(b64) as Uint8Array_;
  // deno-lint-ignore no-explicit-any
  return new Uint8Array((output.buffer as any)
    .transfer(decode(output, 0, 0, rBase64Alphabet, padding)));
}

/**
 * Convert data into a base64url-encoded string (without padding).
 *
 * @see {@link https://www.rfc-editor.org/rfc/rfc4648.html#section-5}
 *
 * @param data The data to encode.
 * @returns The base64url-encoded string.
 */
export function encodeBase64Url(
  data: ArrayBuffer | Uint8Array | string,
): string {
  if (typeof data === "string") {
    data = new TextEncoder().encode(data) as Uint8Array_;
  } else if (data instanceof ArrayBuffer) data = new Uint8Array(data).slice();
  else data = data.slice();
  const [output, i] = detach(
    data as Uint8Array_,
    calcSizeBase64((data as Uint8Array_).length),
  );
  let o = encode(output, i, 0, base64UrlAlphabet, padding);
  o = output.indexOf(padding, o - 2);
  return new TextDecoder().decode(
    // deno-lint-ignore no-explicit-any
    o > 0 ? new Uint8Array((output.buffer as any).transfer(o)) : output,
  );
}

/**
 * Decodes a given base64url-encoded string. Padding is optional.
 *
 * @see {@link https://www.rfc-editor.org/rfc/rfc4648.html#section-5}
 *
 * @param b64url The base64url-encoded string to decode.
 * @returns The decoded data.
 */
export function decodeBase64Url(b64url: string): Uint8Array<ArrayBuffer> {
  const output = new TextEncoder().encode(b64url) as Uint8Array_;
  // deno-lint-ignore no-explicit-any
  return new Uint8Array((output.buffer as any)
    .transfer(decode(output, 0, 0, rBase64UrlAlphabet, padding)));
}
