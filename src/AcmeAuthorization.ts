import type { AcmeAccount } from "./AcmeAccount.ts";
import {
  AcmeChallenge,
  type AcmeChallengeObjectSnapshot,
  type AcmeChallengeType,
  Dns01Challenge,
} from "./AcmeChallenge.ts";
import type { AcmeOrder } from "./AcmeOrder.ts";

/**
 * Represents the status of an authorization.
 *
 * - `pending`: Waiting for challenge completion.
 * - `valid`: Challenge successfully completed.
 * - `invalid`: Certificate Authority (CA) cannot verify challenge and gave up.
 * - `deactivated`: Manually deactivated.
 * - `expired`: Not used in time.
 * - `revoked`: Revoked for security reasons.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8555#section-7.1.6
 */
export type AcmeAuthorizationStatus =
  | "pending"
  | "valid"
  | "invalid"
  | "deactivated"
  | "expired"
  | "revoked";

/**
 * A snapshot of the authorization object retrieved from a Certificate Authority (CA).
 *
 * This can be retrieved by {@link AcmeAuthorization.prototype.fetch}
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8555#section-7.1.4
 */
export type AcmeAuthorizationObjectSnapshot = {
  /**
   * The status of the authorization.
   */
  status: AcmeAuthorizationStatus;
  /**
   * The timestamp after which the server will consider this authorization `invalid`.
   *
   * This field is REQUIRED for objects with `valid` in the `status` field.
   *
   * Format: ISO 8601 (e.g., `2024-10-10T14:30:00Z`).
   */
  expires?: string;

  /**
   * The domain for which the certificate is being requested.
   *
   * Each object contains the type (typically "dns") and the value,
   * which is the domain name.
   */
  identifier: {
    type: "dns";
    /**
     * The domain for this authorization.
     *
     * For wildcard authorizations, the value will be the base domain
     * without the `*.` prefix. Instead, {@link AcmeAuthorizationObjectSnapshot.wildcard}
     * will be set to `true`.
     */
    value: string;
  };

  /**
   * A list of challenge objects for this authorization.
   *
   * Each challenge object contains details about a specific type
   * of ACME challenge (e.g., DNS-01). The client must complete
   * one of the challenges to prove control over the domain.
   */
  challenges: AcmeChallengeObjectSnapshot[];

  /**
   * Whether the authorization is for a wildcard domain.
   */
  wildcard?: boolean;
};

/**
 * Represents the Certificate Authority's (CA) authorization for an account to represent an domain.
 *
 * Tip: Think of it as a containment of some {@link AcmeChallenge}s.
 */
export class AcmeAuthorization {
  /** The {@link AcmeOrder} this authorization belongs to. */
  readonly order: AcmeOrder;
  /** The authorization url uniquely identifies the authorization and for retrieving {@link AcmeAuthorizationObjectSnapshot}. */
  readonly url: string;
  #domain?: string;
  #challenges?: readonly AcmeChallenge[];

  /**
   * The domain associated with this authorization
   *
   * Analogous to the `value` in {@link AcmeAuthorizationObjectSnapshot.identifier}
   */
  get domain(): string {
    if (this.#domain === undefined) {
      throw new Error(
        "domain is not initiated. Was this AcmeAuthorization object created with `await AcmeAuthorization.init(...)`?",
      );
    }
    return this.#domain;
  }

  /**
   * A list of {@link AcmeChallenge} the Certificate Authority can accept to verify control over this authorization / domain.
   */
  get challenges(): readonly AcmeChallenge[] {
    if (this.#challenges === undefined) {
      throw new Error(
        "challenges are not initiated. Was this AcmeAuthorization object created with `await AcmeAuthorization.init(...)`?",
      );
    }

    return this.#challenges;
  }

  /**
   * Internal constructor.
   *
   * @internal
   */
  protected constructor(
    {
      order,
      url,
    }: {
      url: string;
      order: AcmeOrder;
    },
  ) {
    this.order = order;
    this.url = url;
  }

  /**
   * Internal constructor method.
   *
   * Initialize the AcmeAuthorization object by fetching from the given
   * authorization url and instantiate a list of {@link AcmeChallenge}
   * accessible from {@link AcmeAuthorization.prototype.challenges}.
   *
   * @internal
   */
  static async init({ order, url }: {
    order: AcmeOrder;
    url: string;
  }): Promise<AcmeAuthorization> {
    const authorization = new AcmeAuthorization({
      order,
      url,
    });

    const authorizationResponse = await authorization.fetch();

    authorization.#challenges = authorizationResponse.challenges.map(
      ({ token, type, url }) => {
        return new AcmeChallenge({
          authorization,
          token,
          type,
          url,
        });
      },
    );

    if (authorizationResponse.identifier.type !== "dns") {
      throw new Error("Unsupported identifier type");
    }

    authorization.#domain = authorizationResponse.identifier.value;

    return authorization;
  }

  get #account(): AcmeAccount {
    return this.order.account;
  }

  /**
   * Fetches a snapshot of the authorization object from the Certificate Authority (CA).
   */
  async fetch(): Promise<AcmeAuthorizationObjectSnapshot> {
    const response = await this.#account.jwsFetch(this.url);

    return await response.json();
  }

  /**
   * Find the {@link AcmeChallenge} as specified in `type`.
   *
   * {@link AcmeAuthorization.prototype.findDns01Challenge} is probably more useful in most cases.
   *
   * To get the list of challenges, use {@link AcmeAuthorization.prototype.challenges}
   */
  findChallenge(
    type: AcmeChallengeType,
  ): AcmeChallenge | undefined {
    return this.challenges.find((challenge) => {
      return challenge.type === type;
    });
  }

  /**
   * Find the first {@link Dns01Challenge}.
   */
  findDns01Challenge(): Dns01Challenge | undefined {
    const challenge = this.findChallenge("dns-01");
    if (challenge === undefined) {
      return undefined;
    }

    return Dns01Challenge.from(challenge);
  }
}
