import type { AcmeAccount } from "./AcmeAccount.ts";
import type { AcmeAuthorization } from "./AcmeAuthorization.ts";
import type { AcmeClient } from "./AcmeClient.ts";
import type { AcmeOrder } from "./AcmeOrder.ts";
import { encodeBase64Url } from "./utils/encoding.ts";

export type AcmeChallengeType = "http-01" | "dns-01" | "tls-alpn-01"; // the type of challenge (common types shown)
export type AcmeChallengeObjectSnapshot = {
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

export type AcmeChallengeInit = {
  authorization: AcmeAuthorization;
  token: string;
  type: AcmeChallengeType;
  url: string;
};

/**
 * Represents a way to proof control over a domain as offered by the Certificate Authority's (CA).
 */
export class AcmeChallenge {
  readonly authorization: AcmeAuthorization;
  readonly token: string;
  readonly type: AcmeChallengeType;
  readonly url: string;

  /** @internal {@link AcmeChallenge} is created when the {@link AcmeAuthorization} is initialized */
  constructor({
    authorization,
    token,
    type,
    url,
  }: AcmeChallengeInit) {
    this.authorization = authorization;
    this.token = token;
    this.type = type;
    this.url = url;
  }

  get client(): AcmeClient {
    return this.authorization.order.client;
  }

  get account(): AcmeAccount {
    return this.authorization.order.account;
  }

  get order(): AcmeOrder {
    return this.authorization.order;
  }

  async fetch(): Promise<AcmeChallengeObjectSnapshot> {
    const authorization = await this.authorization.fetch();
    const challengeObject = authorization.challenges.find(({ url }) =>
      url === this.url
    );

    if (challengeObject === undefined) {
      throw new Error("Cannot find challenge object");
    }

    return challengeObject;
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
          `${this.token}.${await getJWKThumbprint(
            publicKeyJwk,
          )}`,
        ),
      ),
    );
  }

  async submit(): Promise<unknown> {
    const response = await this.account.jwsFetch(this.url, {
      /**
       * We must send {} to signify submit
       * {@link https://datatracker.ietf.org/doc/html/rfc8555#section-7.5.1}
       */
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
