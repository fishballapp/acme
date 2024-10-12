// deno-lint-ignore no-unused-vars -- imported for jsdoc
import type { ACME_DIRECTORY_URLS } from "./ACME_DIRECTORY_URLS.ts";
import { AcmeAccount } from "./AcmeAccount.ts";
import { generateKeyPair } from "./utils/crypto.ts";
import { jwsFetch } from "./utils/jws.ts";

const REPLAY_NONCE_HEADER_KEY = "Replay-Nonce";

/**
 * The directory object.
 * @see https://datatracker.ietf.org/doc/html/rfc8555#section-7.1.1
 */
export type AcmeDirectory = {
  keyChange: string;
  newAccount: string;
  newNonce: string;
  newOrder: string;
  renewalInfo: string;
  revokeCert: string;
};

/**
 * The entry point of the ACME process. {@link AcmeClient} interacts with the
 * Certificate Authority (CA) based on the provided {@link AcmeDirectory}.
 */
export class AcmeClient {
  public readonly directory: AcmeDirectory;
  #nonceQueue: string[] = [];

  async #fetchNonce(): Promise<string> {
    const response = await fetch(this.directory.newNonce, { method: "HEAD" });
    return response.headers.get(REPLAY_NONCE_HEADER_KEY) ?? (() => {
      throw new Error("Failed to get new nonce :'(");
    })();
  }

  /** @internal Use {@link AcmeClient.init} instead */
  private constructor({ directory }: { directory: AcmeDirectory }) {
    this.directory = directory;
  }

  /**
   * Initiate the AcmeClient.
   *
   * This function fetches the given `directoryUrl` and use the result to
   * create a AcmeClient.
   *
   * You can find some commone CA directories in {@link ACME_DIRECTORY_URLS}
   *
   * @example Creating AcmeClient with Let's Encrypt's directory
   * ```ts
   * import { ACME_DIRECTORY_URLS, AcmeClient } from "@fishballpkg/acme";
   *
   * const acmeClient = await AcmeClient.init(ACME_DIRECTORY_URLS.LETS_ENCRYPT)
   * ```
   */
  static async init(directoryUrl: string): Promise<AcmeClient> {
    return new AcmeClient({
      directory: await (await fetch(directoryUrl)).json(),
    });
  }

  /**
   * Fetch a url where the data are signed with the provided private key using JSON Web Signature (JWS).
   */
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
    const nonce = this.#nonceQueue.shift() ?? await this.#fetchNonce();

    const response = await jwsFetch(url, {
      privateKey,
      protected: {
        alg: "ES256",
        nonce,
        ...protectedHeaders,
      },
      payload,
    });

    this.#nonceQueue.push(
      response.headers.get(REPLAY_NONCE_HEADER_KEY) ??
        await this.#fetchNonce(),
    );

    return response;
  }

  /**
   * Create an account with the Certificate Authority (CA) that AcmeClient was initialized with.
   *
   * You must provide an `email`. Although this is not required by the ACME specification and some CAs,
   * it is generally considered a good practice to do so as it allows the CA to reach out for important
   * notifications, such as certificate expiration reminders or policy changes.
   *
   * @see https://datatracker.ietf.org/doc/html/rfc8555#section-7.3
   */
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

    return new AcmeAccount({
      client: this,
      url: accountUrl,
      keyPair,
    });
  }

  /**
   * Login with an existing account with a keyPair
   *
   * @see https://datatracker.ietf.org/doc/html/rfc8555#section-7.3.1
   */
  async login({ keyPair }: { keyPair: CryptoKeyPair }): Promise<AcmeAccount> {
    const response = await this.jwsFetch(this.directory.newAccount, {
      privateKey: keyPair.privateKey,
      protected: {
        jwk: await crypto.subtle.exportKey("jwk", keyPair.publicKey),
      },
    });

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

    return new AcmeAccount({
      client: this,
      url: accountUrl,
      keyPair,
    });
  }
}
