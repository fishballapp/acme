export const encodeBase64Url = (
  input: string | ArrayBuffer | Uint8Array,
): string => {
  const bytes: string = (() => {
    if (typeof input === "string") return input;
    return String.fromCharCode(
      ...(input instanceof ArrayBuffer ? new Uint8Array(input) : input),
    );
  })();

  return btoa(bytes)
    // https://github.com/denoland/std/pull/3682#issuecomment-2417603682
    .replace(/=?=$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
};
