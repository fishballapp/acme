import { sign } from "../utils/crypto.ts";
import { encodeBase64Url } from "./encoding.ts";

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
}) =>
  await fetch(url, {
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

const jws = async (
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
