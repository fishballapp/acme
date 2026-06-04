import { decodeBase64 } from "./base64.ts";

export const extractFirstPemObject = (pem: string): Uint8Array<ArrayBuffer> =>
  decodeBase64(
    pem.replace(/-----BEGIN [^-]+-----/, "")
      .replace(/-----END [^-]+-----.*$/s, "")
      .replaceAll(/\s/g, ""),
  );
