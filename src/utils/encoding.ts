const toUint8Array = (
  input: string | ArrayBuffer | Uint8Array<ArrayBuffer>,
) => {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return new TextEncoder().encode(input);
};

export const encodeBase64Url = (
  input: string | ArrayBuffer | Uint8Array<ArrayBuffer>,
): string => {
  return toUint8Array(input).toBase64({
    alphabet: "base64url",
    omitPadding: true,
  });
};

export const encodeBase64 = (
  input: ArrayBuffer | string | Uint8Array<ArrayBuffer>,
): string => {
  return toUint8Array(input).toBase64({
    alphabet: "base64",
  });
};
