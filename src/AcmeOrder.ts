import type { AcmeAccount } from "./AcmeAccount.ts";
import { AcmeAuthorization } from "./AcmeAuthorization.ts";
import { generateKeyPair } from "./utils/crypto.ts";
import { encodeBase64Url } from "./utils/encoding.ts";
import { generateCSR } from "./utils/generateCSR.ts";

/**
 * A snapshot of the order object retrieved from a Certificate Authority (CA).
 *
 * This can be retrieved by {@link AcmeOrder.fetch}
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8555#section-7.1.3
 */
export type AcmeOrderObjectSnapshot = {
  /**
   * The status of the order.
   *
   * @see {@link AcmeOrderStatus}
   */
  status: AcmeOrderStatus;
  /**
   * The timestamp after which the Certificate Authority (CA)
   * will consider this order `invalid`.
   *
   * Format: ISO 8601 (e.g., `2024-10-10T14:30:00Z`).
   */
  expires: string; // the expiry date of the order
  /**
   * The domain(s) for which the certificate is being requested.
   *
   * Each object contains the type (typically "dns") and the value,
   * which is the domain name.
   *
   * Please note that for wildcard domains, the `*.` prefix will not appear in the value.
   * Instead, {@link AcmeAuthorizationObjectSnapshot.wildcard} will be set to `true`.
   */
  identifiers: {
    type: "dns";
    value: string;
  }[];
  /**
   * An array of URLs for the authorization objects.
   *
   * Each URL points to an authorization resource that must be
   * completed (usually via challenges) before the certificate
   * can be issued.
   */
  authorizations: string[];
  /**
   * The URL to finalize the order.
   *
   * This URL is used to request the issuance of the certificate
   * once the challenges have been completed.
   */
  finalize: string;
  /**
   * The URL to the issued certificate, if available.
   *
   * This is present once the certificate has been successfully issued.
   * If the order is still processing or invalid, this field may be undefined.
   */
  certificate?: string;
};

/**
 * The status of this order.
 *
 * - `pending`: The order has been created, but the necessary challenges have not yet been completed.
 * - `ready`: All challenges have been successfully completed, and the certificate can be requested.
 * - `processing`: The Certificate Authority (CA) is issuing the certificate.
 * - `valid`: The order has been successfully processed, and the certificate has been issued.
 * - `invalid`: The order has failed, possibly due to failed challenges or an error during processing.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8555#section-7.1.6
 */
export type AcmeOrderStatus =
  | "pending"
  | "ready"
  | "processing"
  | "valid"
  | "invalid";

/**
 * Represents your request for a certificate.
 */
export class AcmeOrder {
  /** The {@link AcmeAccount} this order belongs to. */
  readonly account: AcmeAccount;
  /** The order url uniquely identifies the order and retrieving {@link AcmeOrderObjectSnapshot}. */
  readonly url: string;
  #domains?: readonly string[];
  #authorizations?: readonly AcmeAuthorization[];

  /**
   * The domains used to create this order.
   *
   * Analogous to the `value` in the identifier object from {@link AcmeOrderObjectSnapshot}
   */
  get domains(): readonly string[] {
    if (this.#domains === undefined) {
      throw new Error(
        "domains are not initiated. Was this AcmeOrder object created with `await AcmeOrder.init(...)`?",
      );
    }

    return this.#domains;
  }

  /**
   * A list of {@link AcmeAuthorization}.
   */
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
    url,
  }: {
    account: AcmeAccount;
    url: string;
  }) {
    this.account = account;
    this.url = url;
  }

  /**
   * An internal function used to initialize the {@link AcmeOrder}.
   *
   * This function fetches the authorization urls to create the {@link AcmeAuthorization}
   * objects which are then assigned to {@link AcmeOrder.authorizations}
   *
   * @internal If you are trying to create an order, use {@link AcmeAccount.createOrder}.
   */
  static async init(
    {
      account,
      domains,
      url,
      authorizationUrls,
    }: {
      account: AcmeAccount;
      url: string;
      domains?: string[];
      authorizationUrls?: string[];
    },
  ): Promise<AcmeOrder> {
    const order = new AcmeOrder({
      account,
      url,
    });

    if (domains === undefined || authorizationUrls === undefined) {
      const orderObject = await order.fetch();
      domains = orderObject.identifiers.map(({ value }) => value);
      authorizationUrls = orderObject.authorizations;
    }

    order.#domains = domains;
    order.#authorizations = await Promise.all(
      authorizationUrls.map(async (url) =>
        await AcmeAuthorization.init({ order, url })
      ),
    );

    return order;
  }

  /**
   * Fetches a snapshot of the order object from the Certificate Authority (CA).
   */
  async fetch(): Promise<AcmeOrderObjectSnapshot> {
    const response = await this.account.jwsFetch(this.url);

    return await response.json();
  }

  /**
   * Fetches the order every {@link interval} until its status is {@link pollUntil}.
   */
  async pollStatus({
    pollUntil,
    interval = 5000,
    onBeforeAttempt,
    onAfterFailAttempt,
  }: {
    /** The order status to resolve the returned promise. */
    pollUntil: AcmeOrderStatus;
    /** The time to wait before the next fetch happens. */
    interval?: number;
    /** A callback that fires before *every* fetch attempt. */
    onBeforeAttempt?: () => void;
    /** A callback that fires after *every* fetch attempt that does not produce {@link pollUntil}. */
    onAfterFailAttempt?: (order: AcmeOrderObjectSnapshot) => void;
  }): Promise<AcmeOrderObjectSnapshot> {
    while (true) {
      onBeforeAttempt?.();
      const orderResponse = await this.fetch();
      if (orderResponse.status === pollUntil) {
        return orderResponse;
      }
      onAfterFailAttempt?.(orderResponse);
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  /**
   * Finalize the order.
   *
   * This should be called once the challenge is submitted and the order status becomes `ready`.
   *
   * Under the hood, a new `CryptoKeyPair` that is different to {@link AcmeAccount.keyPair} is generated.
   * A Certificate Signing Request (CSR) will be generated using the new `CryptoKeyPair` and be submitted to the Certificate Authority (CA).
   *
   * @returns A `Promise` that resolves to the newly generated `CryptoKeyPair`.
   */
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

    await response.body?.cancel();

    return csrKeyPair;
  }

  /**
   * Retrieve the certificate in PEM format as string.
   *
   * You should only call this once the order is finalized and its status becomes `valid`.
   *
   * Tip: use {@link AcmeOrder.finalize} and {@link AcmeOrder.pollStatus}
   */
  async getCertificate(): Promise<string> {
    const orderResponse = await this.fetch();
    if (typeof orderResponse.certificate !== "string") {
      throw new Error("Cannot find certificate url. Is the order finalized?");
    }

    const response = await this.account.jwsFetch(orderResponse.certificate);

    return await response.text();
  }
}
