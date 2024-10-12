import { afterEach, dotenv, path } from "../../test_deps.ts";

type CreateDnsRecordResponse = {
  success: true;
  result: {
    id: string;
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
    this.#createdDnsRecordIds = [];
    await Promise.all(
      dnsRecordIdsToRemove.map(async (dnsRecordId) => {
        const response = await this.#fetch(
          `${CLOUDFLARE_ENDPOINT}/zones/${this.#zoneId}/dns_records/${dnsRecordId}`,
          { method: "DELETE" },
        );

        const responseBody = await response.json();

        if (!response.ok) {
          console.error(responseBody);
          console.error(
            `Failed to remove ${dnsRecordId}. Please check manually!`,
          );
        }
      }),
    );
  }

  /**
   * Creates dns record
   *
   * @see https://developers.cloudflare.com/api/operations/dns-records-for-a-zone-create-dns-record
   */
  async createDnsRecord({
    name,
    type,
    content,
  }: {
    name: string;
    type: "TXT";
    content: string;
  }): Promise<CreateDnsRecordResponse["result"]> {
    console.log(`⏳ Creating ${type} Record for ${name} - ${content}...`);
    const response = await this.#fetch(
      `${CLOUDFLARE_ENDPOINT}/zones/${this.#zoneId}/dns_records`,
      {
        method: "POST",
        body: JSON.stringify(
          {
            proxied: false,
            name,
            type,
            content,
            ttl: 60,
            comment: `GENERATED ${
              new Date().toISOString()
            } BY @fishballpkg/acme E2E`,
          },
        ),
      },
    );

    if (!response.ok) {
      console.error(await response.json());
      throw new Error("fail to createDnsRecord");
    }

    const { result }: CreateDnsRecordResponse = await response.json();
    console.log(`✅ DNS record created`, result);
    this.#createdDnsRecordIds.push(result.id);
    return result;
  }
}
