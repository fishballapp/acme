import { describe, expect, it } from "../../test_deps.ts";
import { generateKeyPair } from "../utils/crypto.ts";
import type { PemCryptoKeyPair } from "./mod.ts";
import * as CryptoKeyUtils from "./mod.ts";

describe("CryptoKeyUtils", () => {
  it("should export and import to the same key pair", async () => {
    const keyPair = await generateKeyPair();
    const pemKeyPair = await CryptoKeyUtils.exportKeyPairToPem(keyPair);
    expect(pemKeyPair.privateKey).toMatch(
      /^-----BEGIN PRIVATE KEY-----\n.+?\n-----END PRIVATE KEY-----$/s,
    );
    expect(pemKeyPair.publicKey).toMatch(
      /^-----BEGIN PUBLIC KEY-----\n.+?\n-----END PUBLIC KEY-----$/s,
    );

    const newKeyPair = await CryptoKeyUtils.importKeyPairFromPemPrivateKey(
      pemKeyPair.privateKey,
    );
    expect(newKeyPair.privateKey).not.toBe(keyPair.privateKey);
    expect(newKeyPair.publicKey).not.toBe(keyPair.publicKey);

    const [newPrivateKeyJwk, newPublicKeyJwk, privateKeyJwk, publicKeyJwk] =
      await Promise.all([
        crypto.subtle.exportKey("jwk", newKeyPair.privateKey),
        crypto.subtle.exportKey("jwk", newKeyPair.publicKey),
        crypto.subtle.exportKey("jwk", keyPair.privateKey),
        crypto.subtle.exportKey("jwk", keyPair.publicKey),
      ]);

    expect(newPrivateKeyJwk).toEqual(privateKeyJwk);
    expect(newPublicKeyJwk).toEqual(publicKeyJwk);
  });

  it("should import and export to the same key pair pem", async () => {
    /**
     * generated from this command:
     * ```
     * PRIVATE_KEY=$(openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt -outform PEM) && \
     * echo "$PRIVATE_KEY" && \
     * echo "$PRIVATE_KEY" | openssl ec -pubout
     * ```
     */
    const pemKeyPair: PemCryptoKeyPair = {
      privateKey: `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQghI1IlgiYmppCyzuK
EsV2SkE0+o+Rd0tlIuCXaHk2pRuhRANCAAQynuucB8UmeBGFdoTbr7BCj1gzqFnu
opWatNSFAi7oVa9k83PoyNlS88jcJ9E5D1WyFu9N1OUippPJ/MdZ+lq6
-----END PRIVATE KEY-----`,
      publicKey: `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEMp7rnAfFJngRhXaE26+wQo9YM6hZ
7qKVmrTUhQIu6FWvZPNz6MjZUvPI3CfROQ9VshbvTdTlIqaTyfzHWfpaug==
-----END PUBLIC KEY-----`,
    };

    const keyPair = await CryptoKeyUtils.importKeyPairFromPemPrivateKey(
      pemKeyPair.privateKey,
    );

    expect(await CryptoKeyUtils.exportKeyPairToPem(keyPair)).toEqual(
      pemKeyPair,
    );
  });
});
