import type { AcmeAccount } from "./AcmeAccount.ts";
import { AcmeAuthorization } from "./AcmeAuthorization.ts";
import type { AcmeClient } from "./AcmeClient.ts";
import { generateKeyPair } from "./utils/crypto.ts";
import { encodeBase64Url } from "./utils/encoding.ts";
import { generateCSR } from "./utils/generateCSR.ts";

export type AcmeOrderObjectSnapshot = {
  status: AcmeOrderStatus;
  expires: string; // the expiry date of the order
  identifiers: {
    type: "dns"; // the identifier type, usually DNS
    value: string; // the domain name
  }[];
  authorizations: string[]; // array of URLs to authorization resources
  finalize: string; // URL to finalize the order
  certificate?: string; // URL to download the certificate, available if status is 'valid'
};

export type AcmeOrderStatus =
  | "pending"
  | "ready"
  | "processing"
  | "valid"
  | "invalid";

const fetchOrder = async (
  { url, account }: Pick<AcmeOrder, "url" | "account">,
): Promise<AcmeOrderObjectSnapshot> => {
  const response = await account.jwsFetch(url);

  return await response.json();
};

export type AcmeOrderInit = {
  account: AcmeAccount;
  domains: string[];
  url: string; // The order url
};

/**
 * Represents your request for a certificate.
 */
export class AcmeOrder {
  readonly account: AcmeAccount;
  readonly url: string; // The order url
  readonly domains: string[];
  #authorizations?: readonly AcmeAuthorization[];

  get authorizations(): readonly AcmeAuthorization[] {
    if (this.#authorizations === undefined) {
      throw new Error(
        "authorizations are not initiated. Was this AcmeOrder object created with `await AcmeOrder.init(...)`?",
      );
    }

    return this.#authorizations;
  }

  private constructor({
    account,
    domains,
    url,
  }: AcmeOrderInit) {
    this.account = account;
    this.url = url;
    this.domains = domains;
  }

  /** @internal */
  static async init(
    {
      account,
      domains,
      url,
      authorizationUrls,
    }: AcmeOrderInit & { authorizationUrls?: string[] },
  ): Promise<AcmeOrder> {
    const order = new AcmeOrder({
      account,
      domains,
      url,
    });

    authorizationUrls ??= (await order.fetch()).authorizations;

    order.init({
      authorizations: await Promise.all(
        authorizationUrls.map(async (url) =>
          await AcmeAuthorization.init({ order, url })
        ),
      ),
    });

    return order;
  }

  /** @internal */
  init({
    authorizations,
  }: {
    authorizations: readonly AcmeAuthorization[];
  }) {
    this.#authorizations = authorizations;
  }

  get client(): AcmeClient {
    return this.account.client;
  }

  async fetch(): Promise<AcmeOrderObjectSnapshot> {
    return await fetchOrder(this);
  }

  async pollOrderStatus({
    pollUntil,
    onBeforeAttempt,
    onAfterFailAttempt,
  }: {
    pollUntil: AcmeOrderObjectSnapshot["status"];
    onBeforeAttempt?: () => void;
    onAfterFailAttempt?: (order: AcmeOrderObjectSnapshot) => void;
  }): Promise<AcmeOrderObjectSnapshot> {
    while (true) {
      onBeforeAttempt?.();
      const orderResponse = await this.fetch();
      if (orderResponse.status === pollUntil) {
        return orderResponse;
      }
      onAfterFailAttempt?.(orderResponse);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  async finalize(): Promise<CryptoKeyPair> {
    const [csrKeyPair, orderResponse] = await Promise.all([
      generateKeyPair(),
      this.fetch(),
    ]);
    const csr = encodeBase64Url(
      await generateCSR({
        domains: this.domains,
        keyPair: csrKeyPair,
      }),
    );

    const response = await this.account.jwsFetch(orderResponse.finalize, {
      payload: { csr },
    });

    if (!response.ok) {
      console.error(await response.json());
      throw new Error("Error when submitting csr.");
    }

    return csrKeyPair;
  }

  async getCertificate(): Promise<string> {
    const orderResponse = await this.fetch();
    if (typeof orderResponse.certificate !== "string") {
      throw new Error("Cannot find certificate url. Is the order finalized?");
    }

    const response = await this.account.jwsFetch(orderResponse.certificate);

    return await response.text();
  }
}
