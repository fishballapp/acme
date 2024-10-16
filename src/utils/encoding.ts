export const encodeBase64Url = (
  input: string | ArrayBuffer | Uint8Array,
): string => {
  const bytes: string = (() => {
    if (typeof input === "string") return input;
    return String.fromCharCode(
      ...(input instanceof ArrayBuffer ? new Uint8Array(input) : input),
    );
  })();

  return convertBase64ToBase64url(btoa(bytes));
};

function convertBase64ToBase64url(b64: string) {
  return b64.endsWith("=")
    ? b64.endsWith("==")
      ? b64.replace(/\+/g, "-").replace(/\//g, "_").slice(0, -2)
      : b64.replace(/\+/g, "-").replace(/\//g, "_").slice(0, -1)
    : b64.replace(/\+/g, "-").replace(/\//g, "_");
}
