import type { ACME_DIRECTORY_URLS as _ACME_DIRECTORY_URLS } from "./ACME_DIRECTORY_URLS.ts";
import { AcmeAccount } from "./AcmeAccount.ts";
import {
  AccountDoesNotExistError,
  ACME_ERROR_TYPES,
  AcmeError,
  BadNonceError,
} from "./errors.ts";
import { generateKeyPair } from "./utils/crypto.ts";
import { emailsToAccountContacts } from "./utils/emailsToAccountContacts.ts";
import { jwsFetch } from "./utils/jws.ts";

const REPLAY_NONCE_HEADER_KEY = "Replay-Nonce";
const MAX_RETRY_COUNT_ON_BAD_NONCE_ERROR = 5;

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

  /**
   * Internal constructor.
   *
   * Use {@link AcmeClient.init} instead.
   *
   * @internal
   */
  private constructor({ directory }: { directory: AcmeDirectory }) {
    this.directory = directory;
  }

  /**
   * Initiate the AcmeClient.
   *
   * This function fetches the given {@link directoryUrl} to
   * initialize the {@link AcmeClient}.
   *
   * You can find some common ACME directories in {@link ACME_DIRECTORY_URLS}.
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
      retryAttemptCount = 0,
    }: {
      privateKey: CryptoKey;
      protected: Record<PropertyKey, unknown>;
      payload?: Record<PropertyKey, unknown>;
      retryAttemptCount?: number; // number of times this request has been retried
    },
  ): Promise<Response> {
    const nonce = this.#nonceQueue.shift() ?? await this.#fetchNonce();

    const response = await jwsFetch(url, {
      privateKey,
      protected: {
        nonce,
        ...protectedHeaders,
      },
      payload,
    });

    this.#nonceQueue.push(
      response.headers.get(REPLAY_NONCE_HEADER_KEY) ??
        await this.#fetchNonce(),
    );

    if (!response.ok) {
      const error = await response.clone().json();

      if (error.type === ACME_ERROR_TYPES.BAD_NONCE) {
        if (retryAttemptCount >= MAX_RETRY_COUNT_ON_BAD_NONCE_ERROR) {
          throw new BadNonceError(error);
        }

        return await this.jwsFetch(url, {
          privateKey,
          protected: protectedHeaders,
          payload,
          retryAttemptCount: retryAttemptCount + 1,
        });
      }

      // we intentionally return the non-ok response so caller can handle this themselves.
      return response;
    }

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
  async createAccount(
    { emails }: { emails: readonly string[] },
  ): Promise<AcmeAccount> {
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
          contact: emailsToAccountContacts(emails),
        },
      },
    );

    if (!response.ok) {
      throw new AcmeError(await response.json());
    }

    const accountUrl = response.headers.get("Location");
    if (accountUrl === null) {
      console.error(await response.json());
      throw new Error(
        "Cannot find account url which should have been in the 'Location' response header.",
      );
    }

    await response.body?.cancel();

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
      payload: {
        onlyReturnExisting: true,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      if (
        error.type === ACME_ERROR_TYPES.ACCOUNT_DOES_NOT_EXIST
      ) {
        throw new AccountDoesNotExistError(error);
      }
      throw new Error(
        `Failed to login:\n${JSON.stringify(await response.json(), null, 2)}`,
      );
    }

    const accountUrl = response.headers.get("Location");
    if (accountUrl === null) {
      console.error(await response.json());
      throw new Error(
        "Cannot find account url which should have been in the 'Location' response header.",
      );
    }

    await response.body?.cancel();

    return new AcmeAccount({
      client: this,
      url: accountUrl,
      keyPair,
    });
  }
}
