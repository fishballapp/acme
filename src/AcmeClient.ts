import { AcmeAccount } from "./AcmeAccount.ts";
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

/**
 * The entry point of the ACME process. {@link AcmeClient} would interact with the Certificate Authority (CA) based on the provided directory url.
 *
 * You can find some commone CA directories in ACME_DIRECTORY_URLS
 *
 * @example Creating AcmeClient with Let's Encrypt's directory
 * ```ts
 * import { ACME_DIRECTORY_URLS, AcmeClient } from "@fishballpkg/acme";
 *
 * const acmeClient = await AcmeClient.init(ACME_DIRECTORY_URLS.LETS_ENCRYPT)
 * ```
 */
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
}
