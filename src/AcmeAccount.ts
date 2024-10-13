import type { AcmeClient } from "./AcmeClient.ts";
import { AcmeOrder, type AcmeOrderObjectSnapshot } from "./AcmeOrder.ts";

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
