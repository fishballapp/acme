import { encodeBase64 } from "../utils/encoding.ts";
import type { PemCryptoKeyPair } from "./PemCryptoKeyPair.ts";

const formatPEM = (base64: string, type: string) => {
  const pemHeader = `-----BEGIN ${type}-----`;
  const pemFooter = `-----END ${type}-----`;
  const pemBody = base64.match(/.{1,64}/g)?.join("\n") ?? "";
  return `${pemHeader}\n${pemBody}\n${pemFooter}`;
};

/**
 * Export a CryptoKeyPair to PEM strings including the PEM header and footer.
 */
export async function exportKeyPairToPem(
  keyPair: CryptoKeyPair,
): Promise<PemCryptoKeyPair> {
  const [spki, pkcs8] = await Promise.all([
    crypto.subtle.exportKey("spki", keyPair.publicKey),
    crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
  ]);

  const publicKeyPEM = formatPEM(encodeBase64(spki), "PUBLIC KEY");
  const privateKeyPEM = formatPEM(encodeBase64(pkcs8), "PRIVATE KEY");

  return {
    publicKey: publicKeyPEM,
    privateKey: privateKeyPEM,
  };
}
