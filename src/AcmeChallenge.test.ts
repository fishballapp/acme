import { describe, expect, it } from "../test_deps.ts";
import { encodeBase64Url as stdEncodeBase64Url } from "../test_deps.ts";
import { AcmeChallenge, type AcmeChallengeType } from "./AcmeChallenge.ts";
import type { AcmeAuthorization } from "./AcmeAuthorization.ts";
import { generateKeyPair } from "./utils/crypto.ts";

const TOKEN = "test-token-abc123";
const DOMAIN = "example.com";

/**
 * Build a bare {@link AcmeChallenge} wired to a real key pair, without the
 * network round-trips that `AcmeAuthorization.init` would otherwise require.
 * The `const T` on `AcmeChallenge` preserves the literal type, so e.g.
 * `buildChallenge("http-01")` yields an `AcmeChallenge<"http-01">`.
 */
const buildChallenge = async <const T extends AcmeChallengeType>(
  type: T,
): Promise<{ challenge: AcmeChallenge<T>; keyPair: CryptoKeyPair }> => {
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

describe("AcmeChallenge#getHttpResource (http-01)", () => {
  it("serves the raw key authorization at the well-known path (RFC 8555 §8.3)", async () => {
    const { challenge, keyPair } = await buildChallenge("http-01");

    const resource = await challenge.getHttpResource();

    expect(resource.url).toBe(
      `http://${DOMAIN}/.well-known/acme-challenge/${TOKEN}`,
    );
    expect(resource.name).toBe(TOKEN);
    // The body MUST be the raw key authorization, NOT the dns-01 digest.
    expect(resource.content).toBe(await expectedKeyAuthorization(keyPair));
    expect(resource.content).toBe(await challenge.keyAuthorization());
    expect(resource.content).not.toBe(await challenge.digestToken());
  });
});

describe("AcmeChallenge#getDnsRecordAnswer (dns-01)", () => {
  it("publishes the digest at the _acme-challenge TXT record (RFC 8555 §8.4)", async () => {
    const { challenge } = await buildChallenge("dns-01");

    const record = await challenge.getDnsRecordAnswer();

    expect(record.type).toBe("TXT");
    expect(record.name).toBe(`_acme-challenge.${DOMAIN}.`);
    expect(record.content).toBe(await challenge.digestToken());
  });
});

describe("narrowing via isType", () => {
  it("unlocks the type-specific methods", async () => {
    // Plain `AcmeChallenge[]` (what `authorization.challenges` hands callers);
    // `isType(...)` narrows each element to the matching instantiation.
    const challenges: AcmeChallenge[] = [
      (await buildChallenge("dns-01")).challenge,
      (await buildChallenge("http-01")).challenge,
    ];

    const seen: AcmeChallengeType[] = [];
    for (const challenge of challenges) {
      if (challenge.is("dns-01")) {
        expect((await challenge.getDnsRecordAnswer()).type).toBe("TXT");
        seen.push("dns-01");
      } else if (challenge.is("http-01")) {
        expect((await challenge.getHttpResource()).url).toContain(
          "/.well-known/acme-challenge/",
        );
        seen.push("http-01");
      }
    }
    expect(seen).toEqual(["dns-01", "http-01"]);
  });
});
