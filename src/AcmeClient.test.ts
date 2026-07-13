import { describe, expect, it } from "../test_deps.ts";
import {
  decodeBase64Url as stdDecodeBase64Url,
  encodeBase64Url as stdEncodeBase64Url,
} from "../test_deps.ts";
import { AcmeClient } from "./AcmeClient.ts";
import { generateKeyPair, importHmacKey } from "./utils/crypto.ts";

type MockFetch = (
  ...args: Parameters<typeof fetch>
) => Response | Promise<Response>;

/** Narrow view of the fetch `init` we actually inspect in these mocks. */
const asInit = (
  init: Parameters<typeof fetch>[1],
): { method?: string; body?: string } =>
  (init ?? {}) as { method?: string; body?: string };

const withMockFetch = async (
  mockFetch: MockFetch,
  fn: () => Promise<void>,
): Promise<void> => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch =
    ((...args) => Promise.resolve(mockFetch(...args))) as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

const DIRECTORY_URL = "https://ca.test/directory";
const NEW_ACCOUNT_URL = "https://ca.test/new-account";
const NEW_NONCE_URL = "https://ca.test/new-nonce";

const buildDirectory = (meta?: Record<string, unknown>) => ({
  keyChange: "https://ca.test/key-change",
  newAccount: NEW_ACCOUNT_URL,
  newNonce: NEW_NONCE_URL,
  newOrder: "https://ca.test/new-order",
  renewalInfo: "https://ca.test/renewal-info",
  revokeCert: "https://ca.test/revoke-cert",
  ...(meta ? { meta } : {}),
});

// A 32-byte (HS256-sized) MAC key, deterministic for reproducible tests.
const HMAC_KEY_BYTES = Uint8Array.from(
  { length: 32 },
  (_, i) => (i * 7 + 1) % 256,
);
const HMAC_KEY_B64URL = stdEncodeBase64Url(HMAC_KEY_BYTES);

const decodeJsonSegment = (b64url: string): Record<string, unknown> =>
  JSON.parse(new TextDecoder().decode(stdDecodeBase64Url(b64url)));

describe("AcmeClient#createAccount with externalAccountBinding", () => {
  it("embeds a spec-compliant binding JWS (RFC 8555 §7.3.4)", async () => {
    let capturedBody: string | undefined;

    const mockFetch: MockFetch = (input, init) => {
      const url = input.toString();
      const method = asInit(init).method ?? "GET";

      if (url === DIRECTORY_URL) {
        return new Response(JSON.stringify(buildDirectory()), {
          headers: { "content-type": "application/json" },
        });
      }
      if (url === NEW_NONCE_URL && method === "HEAD") {
        return new Response(null, { headers: { "Replay-Nonce": "nonce-1" } });
      }
      if (url === NEW_ACCOUNT_URL && method === "POST") {
        capturedBody = asInit(init).body;
        return new Response(JSON.stringify({ status: "valid" }), {
          status: 201,
          headers: {
            "Location": "https://ca.test/acct/1",
            "Replay-Nonce": "nonce-2",
          },
        });
      }
      throw new Error(`unexpected request: ${method} ${url}`);
    };

    await withMockFetch(mockFetch, async () => {
      const client = await AcmeClient.init(DIRECTORY_URL);
      await client.createAccount({
        emails: ["yo@fishball.app"],
        externalAccountBinding: { kid: "kid-abc", hmacKey: HMAC_KEY_B64URL },
      });
    });

    expect(capturedBody).toBeDefined();

    // --- Outer JWS: signed with the account key (jwk header, ES256) ---
    const outer = JSON.parse(capturedBody!);
    const outerProtected = decodeJsonSegment(outer.protected);
    expect(outerProtected.alg).toBe("ES256");
    expect(outerProtected.url).toBe(NEW_ACCOUNT_URL);
    expect(outerProtected.nonce).toBe("nonce-1");
    const outerJwk = outerProtected.jwk as Record<string, unknown>;
    expect(outerJwk.kty).toBe("EC");
    expect(outerJwk.crv).toBe("P-256");

    // --- The binding lives inside the outer payload ---
    const outerPayload = decodeJsonSegment(outer.payload);
    const eab = outerPayload.externalAccountBinding as {
      protected: string;
      payload: string;
      signature: string;
    };
    expect(eab).toBeDefined();
    expect(Object.keys(eab).sort()).toEqual(
      ["payload", "protected", "signature"],
    );

    // --- Inner (binding) JWS protected header (§7.3.4) ---
    const eabProtected = decodeJsonSegment(eab.protected);
    expect(eabProtected.alg).toBe("HS256"); // MAC-based, not ES256
    expect(eabProtected.kid).toBe("kid-abc"); // CA-provided key id
    expect(eabProtected.url).toBe(NEW_ACCOUNT_URL); // same url as outer JWS
    expect("nonce" in eabProtected).toBe(false); // MUST NOT contain a nonce

    // --- Inner payload MUST be the account key, identical to the outer jwk ---
    const eabPayload = decodeJsonSegment(eab.payload);
    expect(eabPayload).toEqual(outerJwk);

    // --- The MAC actually verifies under the provided key ---
    const verifyKey = await crypto.subtle.importKey(
      "raw",
      HMAC_KEY_BYTES,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const verified = await crypto.subtle.verify(
      "HMAC",
      verifyKey,
      stdDecodeBase64Url(eab.signature),
      new TextEncoder().encode(`${eab.protected}.${eab.payload}`),
    );
    expect(verified).toBe(true);
  });

  it("throws before any request when the CA requires EAB but none is given", async () => {
    let newAccountCalled = false;

    const mockFetch: MockFetch = (input, init) => {
      const url = input.toString();
      if (url === DIRECTORY_URL) {
        return new Response(
          JSON.stringify(buildDirectory({ externalAccountRequired: true })),
          { headers: { "content-type": "application/json" } },
        );
      }
      if (
        url === NEW_ACCOUNT_URL && (asInit(init).method ?? "GET") === "POST"
      ) {
        newAccountCalled = true;
      }
      throw new Error(`unexpected request: ${url}`);
    };

    await withMockFetch(mockFetch, async () => {
      const client = await AcmeClient.init(DIRECTORY_URL);
      await expect(
        client.createAccount({ emails: ["yo@fishball.app"] }),
      ).rejects.toThrow("externalAccountRequired");
    });

    expect(newAccountCalled).toBe(false);
  });
});

describe("AcmeClient#login", () => {
  it("derives keyPairAlgorithm from the key pair and signs with the matching alg", async () => {
    let capturedBody: string | undefined;

    const mockFetch: MockFetch = (input, init) => {
      const url = input.toString();
      const method = asInit(init).method ?? "GET";

      if (url === DIRECTORY_URL) {
        return Response.json(buildDirectory());
      }
      if (url === NEW_NONCE_URL) {
        return new Response(null, {
          headers: { "Replay-Nonce": "test-nonce" },
        });
      }
      if (url === NEW_ACCOUNT_URL && method === "POST") {
        capturedBody = asInit(init).body;
        return Response.json({}, {
          headers: { Location: "https://ca.test/account/123" },
        });
      }
      throw new Error(`unexpected request: ${method} ${url}`);
    };

    await withMockFetch(mockFetch, async () => {
      const client = await AcmeClient.init(DIRECTORY_URL);
      const keyPair = await generateKeyPair("rsa-2048");

      const account = await client.login({ keyPair });

      // No keyPairAlgorithm was passed: it must be derived from the key, so
      // certificate keys and key rollover keep using RSA.
      expect(account.keyPairAlgorithm).toBe("rsa-2048");

      const { protected: protectedB64 } = JSON.parse(capturedBody!) as {
        protected: string;
      };
      expect(decodeJsonSegment(protectedB64).alg).toBe("RS256");
    });
  });
});

describe("importHmacKey", () => {
  it("imports a valid base64url HS256 key", async () => {
    const key = await importHmacKey(HMAC_KEY_B64URL);
    expect(key.algorithm).toMatchObject({ name: "HMAC" });
  });

  it("rejects a key shorter than 32 bytes (RFC 7518 §3.2)", async () => {
    const shortKey = stdEncodeBase64Url(new Uint8Array(16));
    await expect(importHmacKey(shortKey)).rejects.toThrow("at least 32 bytes");
  });

  it("rejects a standard-base64 key (non-base64url alphabet)", async () => {
    // '+' and '/' are not in the base64url alphabet, so this fails loudly
    // rather than silently importing a wrong key.
    await expect(importHmacKey("++++////++++////++++////++++////++++////++"))
      .rejects.toThrow();
  });
});
