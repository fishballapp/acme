export const encodeBase64Url = (
  input: string | ArrayBuffer | Uint8Array,
): string =>
  encodeBase64(input)
    // https://github.com/denoland/std/pull/3682#issuecomment-2417603682
    .replace(/=?=$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

export const encodeBase64 = (input: ArrayBuffer | string | Uint8Array) => {
  const str: string = (() => {
    if (typeof input === "string") return input;
    return String.fromCharCode(
      ...(input instanceof ArrayBuffer ? new Uint8Array(input) : input),
    );
  })();
  return btoa(str);
};

export const decodeBase64 = (input: string): Uint8Array => {
  const binaryString = atob(input);

  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
};
