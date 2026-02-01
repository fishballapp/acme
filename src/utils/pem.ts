export const extractFirstPemObject = (pem: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.fromBase64(
    pem.replace(/-----BEGIN [^-]+-----/, "")
      .replace(/-----END [^-]+-----.*$/s, "")
      .replaceAll(/\s/g, ""),
  );
