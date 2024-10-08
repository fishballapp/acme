import {
  AcmeChallenge,
  type AcmeChallengeType,
  type RawAcmeChallengeObject,
} from "./AcmeChallenge.ts";
import type { AcmeOrder } from "./AcmeOrder.ts";

export type RawAcmeAuthorizationResponse = {
  status:
    | "pending"
    | "valid"
    | "invalid"
    | "deactivated"
    | "expired"
    | "revoked"; // the status of the authorization
  expires?: string; // the expiry date of the authorization, optional if not applicable
  identifier: {
    type: "dns"; // identifier type, usually DNS
    value: string; // the domain name
  };
  challenges: RawAcmeChallengeObject[];
  wildcard?: boolean; // optional, true if the identifier is a wildcard domain
};

export class AcmeAuthorization {
  authorizationResponse: RawAcmeAuthorizationResponse;
  order: AcmeOrder;

  constructor(
    { order, authorizationResponse }: {
      order: AcmeOrder;
      authorizationResponse: RawAcmeAuthorizationResponse;
    },
  ) {
    this.order = order;
    this.authorizationResponse = authorizationResponse;
  }

  findChallenge(type: AcmeChallengeType): AcmeChallenge | undefined {
    const challengeObject = this.authorizationResponse.challenges.find((
      challenge,
    ) => challenge.type === type);

    if (challengeObject === undefined) return undefined;

    return new AcmeChallenge({
      authorization: this,
      challengeObject,
    });
  }
}
