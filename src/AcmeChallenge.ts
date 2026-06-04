// deno-lint-ignore no-unused-vars -- imported for jsdoc
import type { DnsUtils } from "./mod.ts";

import type { AcmeAccount } from "./AcmeAccount.ts";
import type { AcmeAuthorization } from "./AcmeAuthorization.ts";
import { encodeBase64Url } from "./utils/base64.ts";

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
 * This can be retrieved by {@link AcmeChallenge.prototype.fetch}.
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
export class AcmeChallenge<
  const T extends AcmeChallengeType = AcmeChallengeType,
> {
  /** The {@link AcmeAuthorization} this challenge belongs to. */
  readonly authorization: AcmeAuthorization;
  /**
   * A random value that uniquely identifies the challenge.
   * This is used to produce the key authorization value in
   * {@link AcmeChallenge.prototype.keyAuthorization},
   * {@link AcmeChallenge.prototype.digestToken},
   * {@link AcmeChallenge.prototype.getDnsRecordAnswer} and
   * {@link AcmeChallenge.prototype.getHttpResource}.
   *
   * This is *NOT* the value you put in your DNS record or HTTP resource.
   */
  readonly token: string;
  /** The challenge type. E.g. `dns-01`. */
  readonly type: T;
  /**
   * The challenge url that uniquely identifies the challenge.
   * This is used to retrieve {@link AcmeAuthorizationObjectSnapshot} and the challenge submission.
   */
  readonly url: string;

  /**
   * Internal constructor.
   *
   * {@link AcmeChallenge} is created when the {@link AcmeAuthorization} is initialized
   *
   * @internal
   */
  constructor({
    authorization,
    token,
    type,
    url,
  }: {
    authorization: AcmeAuthorization;
    token: string;
    type: T;
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
   * Produces the key authorization value for this challenge
   */
  async keyAuthorization(): Promise<string> {
    const publicKeyJwk = await crypto.subtle.exportKey(
      "jwk",
      this.#account.keyPair.publicKey,
    );

    return `${this.token}.${await getJWKThumbprint(
      publicKeyJwk,
    )}`;
  }

  /**
   * Produces the key authorization digest for this challenge by digesting the challenge token.
   */
  async digestToken(): Promise<string> {
    return encodeBase64Url(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          await this.keyAuthorization(),
        ),
      ),
    );
  }

  /**
   * Submit the challenge.
   *
   * You should only call this once you have verified the challenge has been fulfilled.
   *
   * {@link DnsUtils.pollDnsTxtRecord} can be used to verify if a `dns-01` challenge has been fulfilled.
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

  /**
   * Digest the challenge token and return a `Promise` that resolves to the
   * {@link DnsTxtRecord} needed to be set to fulfill the challenge.
   *
   * **Wildcard domains:** For wildcard authorizations (e.g., `*.example.com`),
   * the DNS record name will use the base domain (`_acme-challenge.example.com.`)
   * without the `*.` prefix, as per ACME protocol requirements.
   */
  async getDnsRecordAnswer(
    this: AcmeChallenge<"dns-01">,
  ): Promise<DnsTxtRecord> {
    const domain = this.authorization.domain.startsWith("*.")
      ? this.authorization.domain.slice(2)
      : this.authorization.domain;

    return {
      name: `_acme-challenge.${domain}.`,
      type: "TXT",
      content: await this.digestToken(),
    };
  }

  /**
   * Returns a `Promise` that resolves to the {@link HttpResource} that must be
   * served (the key authorization, unhashed) to fulfill the challenge.
   */
  async getHttpResource(this: AcmeChallenge<"http-01">): Promise<HttpResource> {
    return {
      url:
        `http://${this.authorization.domain}/.well-known/acme-challenge/${this.token}`,
      name: this.token,
      content: await this.keyAuthorization(),
    };
  }
}

/**
 * Any concrete {@link AcmeChallenge}, discriminable by its `.type`.
 *
 * This is a union of the per-type instantiations (as opposed to
 * `AcmeChallenge<AcmeChallengeType>`), so narrowing on `.type` unlocks the
 * type-specific methods:
 *
 * @example
 * ```ts
 * for (const challenge of authorization.challenges) {
 *   if (challenge.type === "dns-01") {
 *     await challenge.getDnsRecordAnswer();
 *   } else if (challenge.type === "http-01") {
 *     await challenge.getHttpResource();
 *   }
 * }
 * ```
 */
export type AnyAcmeChallenge = {
  [T in AcmeChallengeType]: AcmeChallenge<T>;
}[AcmeChallengeType];

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

/**
 * A `dns-01` challenge.
 *
 * @deprecated Use `AcmeChallenge<"dns-01">` instead — e.g. via
 * {@link AcmeAuthorization.prototype.findDns01Challenge} or
 * `findChallenge("dns-01")`.
 */
export type Dns01Challenge = AcmeChallenge<"dns-01">;

/**
 * Represents a DNS `TXT` record
 */
export interface DnsTxtRecord {
  name: string;
  type: "TXT";
  content: string;
}

/**
 * Represents the HTTP challenge file
 */
export interface HttpResource {
  url: string;
  name: string;
  content: string;
}
