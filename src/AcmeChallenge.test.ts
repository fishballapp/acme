import { describe, expect, it } from "../test_deps.ts";
import { encodeBase64Url as stdEncodeBase64Url } from "../test_deps.ts";
import {
  AcmeChallenge,
  type AcmeChallengeType,
  Http01Challenge,
} from "./AcmeChallenge.ts";
import type { AcmeAuthorization } from "./AcmeAuthorization.ts";
import { generateKeyPair } from "./utils/crypto.ts";

const TOKEN = "test-token-abc123";
const DOMAIN = "example.com";

/**
 * Build a bare {@link AcmeChallenge} wired to a real key pair, without the
 * network round-trips that `AcmeAuthorization.init` would otherwise require.
 */
const buildChallenge = async (
  type: AcmeChallengeType,
): Promise<{ challenge: AcmeChallenge; keyPair: CryptoKeyPair }> => {
  const keyPair = await generateKeyPair();
  const authorization = {
    domain: DOMAIN,
    order: { account: { keyPair } },
  } as unknown as AcmeAuthorization;

  const challenge = new AcmeChallenge({
    authorization,
    token: TOKEN,
    type,
    url: "https://ca.test/challenge/1",
  });

  return { challenge, keyPair };
};

/** Independent RFC 7638 / RFC 8555 §8.1 key authorization, computed in-test. */
const expectedKeyAuthorization = async (
  keyPair: CryptoKeyPair,
): Promise<string> => {
  const jwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const canonical = JSON.stringify({
    crv: jwk.crv,
    kty: jwk.kty,
    x: jwk.x,
    y: jwk.y,
  });
  const thumbprint = stdEncodeBase64Url(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical)),
  );
  return `${TOKEN}.${thumbprint}`;
};

describe("AcmeChallenge#keyAuthorization", () => {
  it("is `token.base64url(thumbprint)` (RFC 8555 §8.1)", async () => {
    const { challenge, keyPair } = await buildChallenge("http-01");
    expect(await challenge.keyAuthorization()).toBe(
      await expectedKeyAuthorization(keyPair),
    );
  });

  it("digestToken is the base64url SHA-256 of the key authorization (dns-01, §8.4)", async () => {
    const { challenge, keyPair } = await buildChallenge("dns-01");
    const expectedDigest = stdEncodeBase64Url(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(await expectedKeyAuthorization(keyPair)),
      ),
    );
    expect(await challenge.digestToken()).toBe(expectedDigest);
  });
});

describe("Http01Challenge", () => {
  it("serves the raw key authorization at the well-known path (RFC 8555 §8.3)", async () => {
    const { challenge, keyPair } = await buildChallenge("http-01");
    const http = Http01Challenge.from(challenge);

    const resource = await http.getHttpResource();

    expect(resource.url).toBe(
      `http://${DOMAIN}/.well-known/acme-challenge/${TOKEN}`,
    );
    expect(resource.name).toBe(TOKEN);
    // The body MUST be the raw key authorization, NOT the dns-01 digest.
    expect(resource.content).toBe(await expectedKeyAuthorization(keyPair));
    expect(resource.content).toBe(await challenge.keyAuthorization());
    expect(resource.content).not.toBe(await challenge.digestToken());
  });

  it("rejects a non-http-01 challenge", async () => {
    const { challenge } = await buildChallenge("dns-01");
    expect(() => Http01Challenge.from(challenge)).toThrow(
      "Not a http-01 challenge",
    );
  });
});
