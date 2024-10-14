import type { DnsTxtRecord } from "@fishballpkg/acme";
import { afterEach } from "../../test_deps.ts";

const PEBBLE_CHALLTESTSRV_URL = "http://localhost:8055";

export class PebbleChallTestSrv {
  #createDnsRecordNames: string[] = [];

  constructor() {
    afterEach(async () => {
      console.log("🧹 Cleaning up test DNS records...");
      if (await this.cleanup()) {
        console.log("✅ cleanup done!");
      }
    });
  }

  /**
   * Undo all DNS updates, e.g. delete all dns records created during the test
   */
  async cleanup(): Promise<boolean> {
    const namesToRemove = [...this.#createDnsRecordNames];
    console.log(namesToRemove.join(", "));
    this.#createDnsRecordNames = [];

    const responses = await Promise.all(namesToRemove.map(async (name) => {
      const response = await fetch(
        `${PEBBLE_CHALLTESTSRV_URL}/clear-txt`,
        {
          method: "POST",
          body: JSON.stringify({
            host: name,
          }),
        },
      );
      await response.body?.cancel();

      if (!response.ok) {
        console.error(
          `Failed to remove ${name}. This might affect future test... (or not)`,
        );
      }

      return response;
    }));

    return responses.every((response) => response.ok);
  }

  /**
   * Creates dns record
   *
   * @see https://developers.cloudflare.com/api/operations/dns-records-for-a-zone-create-dns-record
   */
  async createDnsRecords(
    records: DnsTxtRecord[],
  ): Promise<void> {
    await Promise.all(
      records.map(async ({ name, type, content }) => {
        console.log(`⏳ Creating ${type} Record for ${name} - ${content}...`);
        const response = await fetch(
          `${PEBBLE_CHALLTESTSRV_URL}/set-txt`,
          {
            method: "POST",
            body: JSON.stringify({
              host: name,
              value: content,
            }),
          },
        );

        await response.body?.cancel();

        if (!response.ok) {
          throw new Error(`Failed to create dns record`);
        }
        console.log(`✅ DNSRecord(${name}, ${type}, ${content})`);
      }),
    );

    this.#createDnsRecordNames.push(...records.map(({ name }) => name));
  }
}
