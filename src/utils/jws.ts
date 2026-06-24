import { getKeyAlgorithmFamily, sign } from "../utils/crypto.ts";
import { encodeBase64Url } from "./base64.ts";

/**
 * The JWS `alg` for each key family: `ES256` for EC P-256, `RS256` for RSA
 * (RFC 7518 §3.3/§3.4). ACME requires a non-MAC `alg` on account requests
 * (RFC 8555 §6.2), which both satisfy.
 */
const JWS_ALG = { ec: "ES256", rsa: "RS256" } as const;

export const jwsFetch = async (url: string, {
  method = "POST",
  privateKey,
  protected: protectedHeader,
  payload,
}: {
  method?: string;
  privateKey: CryptoKey;
  protected: Record<PropertyKey, unknown>;
  payload?: Record<PropertyKey, unknown>;
}) => {
  return await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/jose+json",
    },
    body: JSON.stringify(
      await jws(privateKey, {
        protected: {
          url,
          ...protectedHeader,
        },
        payload,
      }),
    ),
  });
};

export const jws = async (
  privateKey: CryptoKey,
  data: {
    protected: Record<PropertyKey, unknown>;
    payload?: Record<PropertyKey, unknown>;
  },
): Promise<{
  protected: string;
  payload: string;
  signature: string;
}> => {
  const jwsWithoutSignature = {
    protected: encodeBase64Url(JSON.stringify({
      // Default the `alg` from the signing key, but let an explicit `alg` in
      // `data.protected` win — e.g. External Account Binding signs with an
      // HMAC key and `HS256`, which has no EC/RSA family. `??` short-circuits
      // so getKeyAlgorithmFamily is never asked about such keys.
      alg: data.protected.alg ?? JWS_ALG[getKeyAlgorithmFamily(privateKey)],
      ...data.protected,
    })),
    payload: data.payload === undefined
      ? ""
      : encodeBase64Url(JSON.stringify(data.payload)),
  };

  return {
    ...jwsWithoutSignature,
    signature: encodeBase64Url(
      await sign(
        privateKey,
        new TextEncoder().encode(
          `${jwsWithoutSignature.protected}.${jwsWithoutSignature.payload}`,
        ),
      ),
    ),
  };
};
