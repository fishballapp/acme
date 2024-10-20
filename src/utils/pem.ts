import { decodeBase64 } from "./encoding.ts";

export const extractFirstPemObject = (pem: string): Uint8Array =>
  decodeBase64(
    pem.replace(/-----BEGIN [^-]+-----/, "")
      .replace(/-----END [^-]+-----.*$/s, "")
      .replaceAll(/\s/g, ""),
  );
