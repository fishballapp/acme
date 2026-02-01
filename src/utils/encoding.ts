export const encodeBase64Url = (
  input: string | ArrayBuffer | Uint8Array<ArrayBuffer>,
): string =>
  encodeBase64(input)
    // https://github.com/denoland/std/pull/3682#issuecomment-2417603682
    .replace(/=?=$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

export const encodeBase64 = (
  input: ArrayBuffer | string | Uint8Array<ArrayBuffer>,
) => {
  const str: string = (() => {
    if (typeof input === "string") return input;
    return String.fromCharCode(
      ...(input instanceof ArrayBuffer
        ? new Uint8Array<ArrayBuffer>(input)
        : input),
    );
  })();
  return btoa(str);
};

export const decodeBase64 = (input: string): Uint8Array<ArrayBuffer> => {
  const binaryString = atob(input);

  const bytes = Uint8Array.from(
    { length: binaryString.length },
    (_, i) => binaryString.charCodeAt(i),
  );

  return bytes;
};

/* unused
export const decodeBase64Url = (input: string): Uint8Array<ArrayBuffer> =>
  decodeBase64(
    input
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(input.length + (4 - (input.length % 4)) % 4, "="),
  );
*/
