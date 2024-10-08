import type { AcmeClient } from "./AcmeClient.ts";

export class AcmeAccount {
  client: AcmeClient;
  keyPair: CryptoKeyPair;
  url: string;

  constructor({ client, keyPair, url }: {
    client: AcmeClient;
    keyPair: CryptoKeyPair;
    url: string;
  }) {
    this.client = client;
    this.keyPair = keyPair;
    this.url = url;
  }
}
