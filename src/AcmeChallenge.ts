import type { AcmeAccount } from "./AcmeAccount.ts";
import type { AcmeAuthorization } from "./AcmeAuthorization.ts";
import type { AcmeClient } from "./AcmeClient.ts";
import { encodeBase64Url } from "./utils/encoding.ts";

export type AcmeChallengeType = "http-01" | "dns-01" | "tls-alpn-01"; // the type of challenge (common types shown)
export type RawAcmeChallengeObject = {
  type: AcmeChallengeType;
  status: "pending" | "processing" | "valid" | "invalid"; // the status of the challenge
  url: string; // URL for the challenge resource
  token: string; // the token for completing the challenge
  validationRecord?: {
    hostname?: string;
    port?: string;
    addressesResolved?: string[];
    addressUsed?: string;
  }[];
};

export class AcmeChallenge {
  authorization: AcmeAuthorization;
  challengeObject: RawAcmeChallengeObject;

  constructor({
    authorization,
    challengeObject,
  }: {
    authorization: AcmeAuthorization;
    challengeObject: RawAcmeChallengeObject;
  }) {
    this.authorization = authorization;
    this.challengeObject = challengeObject;
  }

  get client(): AcmeClient {
    return this.authorization.order.client;
  }

  get account(): AcmeAccount {
    return this.authorization.order.account;
  }

  async digestToken(): Promise<string> {
    const publicKeyJwk = await crypto.subtle.exportKey(
      "jwk",
      this.account.keyPair.publicKey,
    );

    return encodeBase64Url(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          `${this.challengeObject.token}.${await getJWKThumbprint(
            publicKeyJwk,
          )}`,
        ),
      ),
    );
  }

  async submit(): Promise<unknown> {
    const response = await this.client.jwsFetch(this.challengeObject.url, {
      privateKey: this.account.keyPair.privateKey,
      protected: {
        kid: this.account.url,
      },
      payload: {},
    });

    if (!response.ok) {
      console.error(await response.json());

      throw new Error("Failed to submit challenge");
    }

    return await response.json();
  }
}

async function getJWKThumbprint(jwk: JsonWebKey): Promise<string> {
  // Step 1: Create the canonical JSON string from required JWK fields,
  const canonicalJWK = JSON.stringify({
    crv: jwk.crv,
    kty: jwk.kty,
    x: jwk.x,
    y: jwk.y,
  });

  // Step 2: Hash the canonical JSON using SHA-256
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJWK),
  );

  // Step 3: Convert the binary hash to base64url encoding
  return encodeBase64Url(hash);
}
