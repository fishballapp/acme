export const uint8ArrayToNumber = (bytes: Uint8Array): number => {
  let x = 0;

  for (const byte of bytes) {
    x <<= 8;
    x |= byte;
  }

  return x;
};

export const unsignedIntegerToUint8Array = (n: number): Uint8Array => {
  if (n < 0 || !Number.isInteger(n)) {
    throw new Error("expect unsigned integer!");
  }

  const bytes: number[] = [];
  let temp = n;
  do {
    bytes.unshift(temp & 0b1111_1111); // Extract the least significant octet
    temp >>= 8; // Remove the least significant byte
  } while (temp > 0);

  return Uint8Array.from(bytes);
};

export const concatUint8Arrays = (
  ...xss: readonly ArrayLike<number>[]
): Uint8Array => {
  const totalLength = xss.reduce((acc, { length }) => acc + length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of xss) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
};
