import type { AcmeAccount } from "./AcmeAccount.ts";
import {
  AcmeChallenge,
  type AcmeChallengeObjectSnapshot,
  type AcmeChallengeType,
} from "./AcmeChallenge.ts";
import type { AcmeClient } from "./AcmeClient.ts";
import type { AcmeOrder } from "./AcmeOrder.ts";

export type AcmeAuthorizationObjectSnapshot = {
  /**
   * - `pending`: Waiting for challenge completion.
   * - `valid`: Challenge successfully completed.
   * - `invalid`: Certificate Authority (CA) cannot verify challenge and gave up.
   * - `deactivated`: Manually deactivated.
   * - `expired`: Not used in time.
   * - `revoked`: Revoked for security reasons.
   * @see https://datatracker.ietf.org/doc/html/rfc8555#section-7.1.6
   */
  status:
    | "pending"
    | "valid"
    | "invalid"
    | "deactivated"
    | "expired"
    | "revoked";
  expires?: string; // the expiry date of the authorization, optional if not applicable
  identifier: {
    type: "dns"; // identifier type, usually DNS
    value: string; // the domain name
  };
  challenges: AcmeChallengeObjectSnapshot[];
  wildcard?: boolean; // optional, true if the identifier is a wildcard domain
};

const fetchAuthorization = async (
  { url, account }: {
    url: string;
    account: AcmeAccount;
  },
): Promise<AcmeAuthorizationObjectSnapshot> => {
  const response = await account.jwsFetch(url);

  return await response.json();
};

/**
 * Represents the Certificate Authority's (CA) authorization for an account to represent an domain.
 *
 * Tip: Think of it as a containment of some {@link AcmeChallenge}.
 */
export class AcmeAuthorization {
  readonly order: AcmeOrder;
  readonly url: string;
  #challenges?: readonly AcmeChallenge[];

  get challenges(): readonly AcmeChallenge[] {
    if (this.#challenges === undefined) {
      throw new Error(
        "challenges are not initiated. Was this AcmeAuthorization object created with `await AcmeAuthorization.init(...)`?",
      );
    }

    return this.#challenges;
  }

  /** @internal {@link AcmeAuthorization} is created when the {@link AcmeOrder} is initialized */
  private constructor(
    { order, url }: {
      url: string;
      order: AcmeOrder;
    },
  ) {
    this.order = order;
    this.url = url;
  }

  /** @internal */
  static async init({ order, url }: {
    order: AcmeOrder;
    url: string;
  }): Promise<AcmeAuthorization> {
    const authorization = new AcmeAuthorization({
      order,
      url,
    });

    const authorizationResponse = await authorization.fetch();

    authorization.init({
      challenges: authorizationResponse.challenges.map(
        ({ token, type, url }) =>
          new AcmeChallenge({
            authorization,
            token,
            type,
            url,
          }),
      ),
    });

    return authorization;
  }

  /**
   * @internal
   */
  init({
    challenges,
  }: {
    challenges: AcmeChallenge[];
  }) {
    this.#challenges = challenges;
  }

  get client(): AcmeClient {
    return this.order.client;
  }

  get account(): AcmeAccount {
    return this.order.account;
  }

  async fetch(): Promise<AcmeAuthorizationObjectSnapshot> {
    return await fetchAuthorization(this);
  }

  findChallenge(type: AcmeChallengeType): AcmeChallenge | undefined {
    return this.challenges.find((challenge) => {
      return challenge.type === type;
    });
  }
}
