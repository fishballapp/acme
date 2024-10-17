import type { AcmeClient } from "./AcmeClient.ts";
import { AcmeOrder, type AcmeOrderObjectSnapshot } from "./AcmeOrder.ts";
import { emailsToAccountContacts } from "./utils/emailsToAccountContacts.ts";

/**
 * Represents the possible status values for an ACME account.
 * - "valid": The account is active and in good standing.
 * - "deactivated": The account has been deactivated by the user or CA.
 * - "revoked": The account has been revoked by the CA.
 */
export type AcmeAccountStatus = "valid" | "deactivated" | "revoked";

/**
 * Represents the ACME account object returned by the server.
 */
export type AcmeAccountObjectSnapshot = {
  /**
   * The status of the ACME account.
   */
  status: AcmeAccountStatus;

  /**
   * An array of contact URIs (e.g., `mailto:user@example.com`) associated with the account.
   * This field is optional.
   */
  contact?: string[];

  /**
   * Indicates whether the user has agreed to the terms of service.
   * This field is optional.
   */
  termsOfServiceAgreed?: boolean;

  /**
   * A URL from which a list of orders associated with this account can be retrieved.
   * This field is optional.
   */
  orders?: string;

  /**
   * External account binding information for the account.
   * This field is optional and can contain any external binding details.
   */
  externalAccountBinding?: unknown;
};

/**
 * {@link AcmeAccount} represents an account you have created with
 * {@link AcmeClient.prototype.login} or {@link AcmeClient.prototype.createAccount}.
 */
export class AcmeAccount {
  readonly client: AcmeClient;
  readonly keyPair: CryptoKeyPair;
  readonly url: string;

  /**
   * Internal constructor.
   *
   * You can use {@link AcmeClient.prototype.login} or
   * {@link AcmeClient.prototype.createAccount} instead.
   *
   * @internal
   */
  constructor(init: {
    client: AcmeClient;
    keyPair: CryptoKeyPair;
    url: string;
  }) {
    this.client = init.client;
    this.keyPair = init.keyPair;
    this.url = init.url;
  }

  /**
   * Fetch a url where the data are signed with the account private key using JSON Web Signature (JWS).
   */
  async jwsFetch(
    url: string,
    {
      protected: protectedHeaders,
      payload,
    }: {
      protected?: Record<PropertyKey, unknown>;
      payload?: Record<PropertyKey, unknown>;
    } = {},
  ): Promise<Response> {
    return await this.client.jwsFetch(url, {
      privateKey: this.keyPair.privateKey,
      protected: {
        kid: this.url,
        ...protectedHeaders,
      },
      payload,
    });
  }

  /**
   * Fetches a snapshot of the account object from the Certificate Authority (CA).
   */
  async fetch(): Promise<AcmeAccountObjectSnapshot> {
    const response = await this.jwsFetch(this.url);
    return await response.json();
  }

  /**
   * Update the contact email of your account
   */
  async update(
    { emails }: { emails: string[] },
  ): Promise<AcmeAccountObjectSnapshot> {
    const response = await this.jwsFetch(this.url, {
      payload: {
        contact: emailsToAccountContacts(emails),
      },
    });

    return await response.json();
  }

  /**
   * Create a certificate order to the Certificate Authority.
   */
  async createOrder(
    {
      domains,
    }: {
      domains: string[];
    },
  ): Promise<AcmeOrder> {
    const response = await this.jwsFetch(
      this.client.directory.newOrder,
      {
        payload: {
          identifiers: domains.map((domain) => ({
            type: "dns",
            value: domain,
          })),
        },
      },
    );

    if (!response.ok) {
      throw await response.json();
    }

    const orderUrl = response.headers.get("Location");
    if (orderUrl === null) {
      console.error(await response.json());
      throw new Error(
        "Cannot find order url which should have been in the 'Location' response header.",
      );
    }

    const orderResponse: AcmeOrderObjectSnapshot = await response.json();

    return await AcmeOrder.init({
      account: this,
      domains,
      url: orderUrl,
      authorizationUrls: orderResponse.authorizations,
    });
  }
}
