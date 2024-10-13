import type { DnsTxtRecord } from "../../src/AcmeChallenge.ts";
import { afterEach, dotenv, path } from "../../test_deps.ts";

type CreateDnsRecordResponse = { id: string };

type BatchResponse = {
  success: true;
  result: {
    posts: CreateDnsRecordResponse[];
  };
};

const CLOUDFLARE_ENDPOINT = "https://api.cloudflare.com/client/v4";
export class CloudflareZone {
  readonly #apiKey: string;
  readonly #zoneId: string;
  #createdDnsRecordIds: string[] = [];

  private constructor({ apiKey, zoneId }: { apiKey: string; zoneId: string }) {
    this.#apiKey = apiKey;
    this.#zoneId = zoneId;

    afterEach(async () => {
      console.log("🧹 Cleaning up test DNS records...");
      await this.cleanup();
    });
  }

  static async init() {
    await dotenv.load({
      envPath: path.join(import.meta.dirname!, "../../.env.e2e.local"),
      export: true,
    });

    return new CloudflareZone({
      apiKey: Deno.env.get("CLOUDFLARE_API_KEY") ?? (() => {
        throw new Error(
          "Cannot find cloudflare API key (`CLOUDFLARE_API_KEY`)",
        );
      })(),
      zoneId: Deno.env.get("CLOUDFLARE_FISHBALL_XYZ_ZONE_ID") ??
        (() => {
          throw new Error(
            "Cannot find cloudflare zone id for fishball.xyz (`CLOUDFLARE_FISHBALL_XYZ_ZONE_ID`)",
          );
        })(),
    });
  }
  async #fetch(
    url: string,
    { headers, ...init }: RequestInit = {},
  ): Promise<Response> {
    return await fetch(url, {
      headers: new Headers([
        ["Content-Type", "application/json"],
        ["Authorization", `Bearer ${this.#apiKey}`],
        ...new Headers(headers),
      ]),
      ...init,
    });
  }

  /**
   * Undo all DNS updates, e.g. delete all dns records created during the test
   */
  async cleanup() {
    const dnsRecordIdsToRemove = [...this.#createdDnsRecordIds];
    console.log(dnsRecordIdsToRemove.join(", "));
    this.#createdDnsRecordIds = [];
    const response = await this.#fetch(
      `${CLOUDFLARE_ENDPOINT}/zones/${this.#zoneId}/dns_records/batch`,
      {
        method: "POST",
        body: JSON.stringify({
          deletes: dnsRecordIdsToRemove.map((id) => ({ id })),
        }),
      },
    );

    const responseBody = await response.json();

    if (!response.ok) {
      console.error(responseBody);
      console.error(
        `Failed to remove ${
          dnsRecordIdsToRemove.join(", ")
        }. Please check manually!`,
      );
    }
  }

  /**
   * Creates dns record
   *
   * @see https://developers.cloudflare.com/api/operations/dns-records-for-a-zone-create-dns-record
   */
  async createDnsRecords(
    records: DnsTxtRecord[],
  ): Promise<void> {
    for (const { type, name, content } of records) {
      console.log(`⏳ Creating ${type} Record for ${name} - ${content}...`);
    }

    const response = await this.#fetch(
      `${CLOUDFLARE_ENDPOINT}/zones/${this.#zoneId}/dns_records/batch`,
      {
        method: "POST",
        body: JSON.stringify(
          {
            posts: records.map(({ name, type, content }) => ({
              proxied: false,
              name,
              type,
              content,
              ttl: 60,
              comment: `GENERATED ${
                new Date().toISOString()
              } BY @fishballpkg/acme E2E`,
            })),
          },
        ),
      },
    );

    if (!response.ok) {
      console.error(await response.json());
      throw new Error("fail to createDnsRecord");
    }

    const { result }: BatchResponse = await response.json();
    const dnsRecordIds = result.posts.map(({ id }) => id);

    console.log("✅ DNS records created");
    console.log(dnsRecordIds.join(", "));

    this.#createdDnsRecordIds.push(...dnsRecordIds);
  }
}
