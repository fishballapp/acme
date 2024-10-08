import type { AcmeAccount } from "./AcmeAccount.ts";
import { AcmeAuthorization } from "./AcmeAuthorization.ts";
import type { AcmeClient } from "./AcmeClient.ts";
import { generateKeyPair } from "./utils/crypto.ts";
import { encodeBase64Url } from "./utils/encoding.ts";
import { generateCSR } from "./utils/generateCSR.ts";

export type RawAcmeOrderResponse = {
  status: "pending" | "ready" | "processing" | "valid" | "invalid"; // the status of the order
  expires: string; // the expiry date of the order
  identifiers: {
    type: "dns"; // the identifier type, usually DNS
    value: string; // the domain name
  }[];
  authorizations: string[]; // array of URLs to authorization resources
  finalize: string; // URL to finalize the order
  certificate?: string; // URL to download the certificate, available if status is 'valid'
};

export class AcmeOrder {
  account: AcmeAccount;
  url: string; // The order url
  orderResponse: RawAcmeOrderResponse;
  domains: string[];

  constructor({
    account,
    domains,
    url,
    orderResponse,
  }: {
    account: AcmeAccount;
    domains: string[];
    url: string; // The order url
    orderResponse: RawAcmeOrderResponse;
  }) {
    this.account = account;
    this.url = url;
    this.orderResponse = orderResponse;
    this.domains = domains;
  }

  get client(): AcmeClient {
    return this.account.client;
  }

  async getAuthorizations(): Promise<AcmeAuthorization[]> {
    const responses = await Promise.all(
      this.orderResponse.authorizations.map((authorizationUrl) =>
        this.client.jwsFetch(authorizationUrl, {
          privateKey: this.account.keyPair.privateKey,
          protected: {
            kid: this.account.url,
          },
        })
      ),
    );

    if (!responses.every(({ ok }) => ok)) {
      console.error(
        "Error responses when fetching authorizations:",
        ...await Promise.all(
          responses.filter(({ ok }) => !ok).map((response) => response.json()),
        ),
      );
      throw new Error("Some authorizations responded with errors");
    }

    return await Promise.all(
      responses.map(async (response) =>
        new AcmeAuthorization({
          order: this,
          authorizationResponse: await response.json(),
        })
      ),
    );
  }

  async fetch(): Promise<RawAcmeOrderResponse> {
    const response = await this.client.jwsFetch(this.url, {
      privateKey: this.account.keyPair.privateKey,
      protected: {
        kid: this.account.url,
        url: this.url,
      },
    });

    this.orderResponse = await response.json();

    return this.orderResponse;
  }

  async pollOrderStatus({
    pollUntil,
    onBeforeAttempt,
    onAfterFailAttempt,
  }: {
    pollUntil: RawAcmeOrderResponse["status"];
    onBeforeAttempt?: () => void;
    onAfterFailAttempt?: (order: RawAcmeOrderResponse) => void;
  }): Promise<RawAcmeOrderResponse> {
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
    const csrKeyPair = await generateKeyPair();
    const csr = encodeBase64Url(
      await generateCSR({
        domains: this.domains,
        keyPair: csrKeyPair,
      }),
    );

    const response = await this.client.jwsFetch(this.orderResponse.finalize, {
      privateKey: this.account.keyPair.privateKey,
      protected: {
        kid: this.account.url,
      },
      payload: { csr },
    });

    if (!response.ok) {
      console.error(await response.json());
      throw new Error("Error when submitting csr.");
    }
    console.log(await response.json());

    return csrKeyPair;
  }

  async getCertificate(): Promise<string> {
    if (typeof this.orderResponse.certificate !== "string") {
      throw new Error("Cannot find certificate url. Is the order finalized?");
    }

    const response = await this.client.jwsFetch(
      this.orderResponse.certificate,
      {
        privateKey: this.account.keyPair.privateKey,
        protected: {
          kid: this.account.url,
        },
      },
    );

    return await response.text();
  }
}
