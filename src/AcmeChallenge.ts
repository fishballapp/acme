// deno-lint-ignore no-unused-vars
import type { Dns01ChallengeUtils } from "./mod.ts"; // imported for jsdoc

import type { AcmeAccount } from "./AcmeAccount.ts";
import type { AcmeAuthorization } from "./AcmeAuthorization.ts";
import { encodeBase64Url } from "./utils/encoding.ts";

/**
 * Different ways to proof control over a domain to the Certificate Authority (CA).
 * Only `dns-01` is supported in this library. But feel free to implement other challenges yourself!
 */
export type AcmeChallengeType = "http-01" | "dns-01" | "tls-alpn-01";

/**
 * Represents the status of a challenge.
 *
 * - `pending`: Waiting for submission.
 * - `processing`: Challenge is submitted and being verified.
 * - `valid`: The challenge is verified.
 * - `invalid`: The challenge has failed verification or has been abandoned by the CA.
 *              You cannot resubmit the challenge but you may create a new order and
 *              kickoff the process again.
 */
export type AcmeChallengeStatus =
  | "pending"
  | "processing"
  | "valid"
  | "invalid";

/**
 * A snapshot of the challenge object retrieved from a Certificate Authority (CA).
 *
 * This can be retrieved by {@link AcmeChallenge.fetch}.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8555#section-7.1.4
 */
export type AcmeChallengeObjectSnapshot = {
  type: AcmeChallengeType;
  status: AcmeChallengeStatus;
  url: string;
  token: string;
  validationRecord?: {
    hostname?: string;
    port?: string;
    addressesResolved?: string[];
    addressUsed?: string;
  }[];
};

/**
 * Represents a way to proof control over a domain as offered by the Certificate Authority's (CA).
 */
export class AcmeChallenge {
  /** The {@link AcmeAuthorization} this challenge belongs to. */
  readonly authorization: AcmeAuthorization;
  /**
   * A random value that uniquely identifies the challenge.
   * This is used to produce the key authorization value in {@link AcmeChallenge.digestToken}.
   *
   * This is *NOT* the value you put in your DNS record.
   */
  readonly token: string;
  /** The challenge type. E.g. `dns-01`. */
  readonly type: AcmeChallengeType;
  /**
   * The challenge url that uniquely identifies the challenge.
   * This is used to retrieve {@link AcmeAuthorizationObjectSnapshot} and the challenge submission.
   */
  readonly url: string;

  /** @internal {@link AcmeChallenge} is created when the {@link AcmeAuthorization} is initialized */
  constructor({
    authorization,
    token,
    type,
    url,
  }: {
    authorization: AcmeAuthorization;
    token: string;
    type: AcmeChallengeType;
    url: string;
  }) {
    this.authorization = authorization;
    this.token = token;
    this.type = type;
    this.url = url;
  }

  get #account(): AcmeAccount {
    return this.authorization.order.account;
  }

  /**
   * Fetches a snapshot of the challenge object from the Certificate Authority (CA).
   */
  async fetch(): Promise<AcmeChallengeObjectSnapshot> {
    const response = await this.#account.jwsFetch(this.url);
    return await response.json();
  }

  /**
   * Produces the key authorization for this challenge by digesting the challenge token.
   */
  async digestToken(): Promise<string> {
    const publicKeyJwk = await crypto.subtle.exportKey(
      "jwk",
      this.#account.keyPair.publicKey,
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

  /**
   * Submit the challenge.
   *
   * You should only call this once you have verified the challenge has been fulfilled.
   *
   * Consider using {@link Dns01ChallengeUtils.pollDnsTxtRecord} to verify DNS-01 challenge.
   */
  async submit(): Promise<unknown> {
    const response = await this.#account.jwsFetch(this.url, {
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
