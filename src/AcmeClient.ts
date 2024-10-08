import { AcmeAccount } from "./AcmeAccount.ts";
import { AcmeOrder, type RawAcmeOrderResponse } from "./AcmeOrder.ts";
import { generateKeyPair } from "./utils/crypto.ts";
import { jwsFetch } from "./utils/jws.ts";

export const REPLAY_NONCE_HEADER_KEY = "Replay-Nonce";

export type ACMEDirectory = {
  keyChange: string;
  newAccount: string;
  newNonce: string;
  newOrder: string;
  renewalInfo: string;
  revokeCert: string;
};

export class AcmeClient {
  public readonly directory: ACMEDirectory;
  #nextNonce: string | undefined = undefined;

  private constructor({ directory }: { directory: ACMEDirectory }) {
    this.directory = directory;
  }

  static async init(directoryUrl: string): Promise<AcmeClient> {
    return new AcmeClient({
      directory: await (await fetch(directoryUrl)).json(),
    });
  }

  async jwsFetch(
    url: string,
    {
      privateKey,
      protected: protectedHeaders,
      payload,
    }: {
      privateKey: CryptoKey;
      protected: Record<PropertyKey, unknown>;
      payload?: Record<PropertyKey, unknown>;
    },
  ): Promise<Response> {
    const nonce = this.#nextNonce ?? await this.#fetchNonce();
    this.#nextNonce = undefined;

    const response = await jwsFetch(url, {
      privateKey,
      protected: {
        alg: "ES256",
        nonce,
        ...protectedHeaders,
      },
      payload,
    });

    this.#nextNonce = response.headers.get(REPLAY_NONCE_HEADER_KEY) ??
      await this.#fetchNonce();

    return response;
  }

  async #fetchNonce(): Promise<string> {
    const response = await fetch(this.directory.newNonce, { method: "HEAD" });
    return response.headers.get(REPLAY_NONCE_HEADER_KEY) ?? (() => {
      throw new Error("Failed to get new nonce :'(");
    })();
  }

  async createAccount({ email }: { email: string }): Promise<AcmeAccount> {
    const keyPair = await generateKeyPair();

    const response = await this.jwsFetch(
      this.directory.newAccount,
      {
        privateKey: keyPair.privateKey,
        protected: {
          jwk: await crypto.subtle.exportKey("jwk", keyPair.publicKey),
        },
        payload: {
          termsOfServiceAgreed: true,
          contact: [`mailto:${email}`],
        },
      },
    );

    if (!response.ok) {
      throw await response.json();
    }

    const accountUrl = response.headers.get("Location");
    if (accountUrl === null) {
      console.error(await response.json());
      throw new Error(
        "Cannot find account url which should have been in the 'Location' response header.",
      );
    }

    this.#nextNonce = response.headers.get(REPLAY_NONCE_HEADER_KEY) ??
      await this.#fetchNonce();

    return new AcmeAccount({
      client: this,
      url: accountUrl,
      keyPair,
    });
  }

  async createOrder(
    { domains, account }: { domains: string[]; account: AcmeAccount },
  ): Promise<AcmeOrder> {
    const response = await this.jwsFetch(this.directory.newOrder, {
      privateKey: account.keyPair.privateKey,
      protected: { kid: account.url },
      payload: {
        identifiers: domains.map((domain) => ({
          type: "dns",
          value: domain,
        })),
      },
    });

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

    const orderResponse: RawAcmeOrderResponse = await response.json();

    return new AcmeOrder({
      account,
      domains,
      url: orderUrl,
      orderResponse,
    });
  }
}
