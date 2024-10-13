/**
 * @module
 *
 * Utility functions to help you with `dns-01` challenge
 */

/**
 * Basically the type of `Deno.resolveDns`. But redefined in case the environment is not in Deno.
 */
export type ResolveDnsFunction = (
  query: string,
  recordType: "A" | "AAAA" | "CNAME" | "NS",
  options?: {
    nameServer?: {
      ipAddr: string;
    };
  },
) => Promise<string[] | string[][]>;

/**
 * Config object for {@link pollDnsTxtRecord}
 */
export type PollDnsTxtRecordConfig = {
  /**
   * The domain to poll `TXT` record for.
   */
  domain: string;
  /**
   * The content of the `TXT` to stop polling.
   */
  pollUntil: string;
  /**
   * The number of milliseconds to wait before the next lookup happen. (Default: 5000)
   */
  interval?: number;
  /**
   * A callback that executes before each DNS lookup.
   */
  onBeforeAttempt?: () => void;
  /**
   * A callback that executes after each "fail" lookup, where no matching `TXT` record is found. It receives the `TXT` records found in this attempt from every authoritative name server.
   */
  onAfterFailAttempt?: (recordss: string[][]) => void;
  /**
   * A function that resolves DNS record.
   *
   * ### For Deno
   *
   * There is no need to pass the `resolveDns` option. `Deno.resolveDns` will be used by default.
   *
   * ### For Other Platforms
   *
   * `pollDnsTxtRecord` performs lookup on 4 record types:
   * - `NS`: Used to find out the authoritative name servers of your domain.
   *   - Expected return type `Promise<string[]>`
   * - `A`: Used to find out the IPv4 addresses of your authoritative name servers.
   *   - Expected return type `Promise<string[]>`
   * - `AAAA`: Used to find out the IPv6 addresses of your authoritative name servers.
   *   - Expected return type `Promise<string[]>`
   * - `TXT`: Used to find out the TXT record of your domain.
   *   - Expected return type `Promise<string[][]>`, where each record is in chunks of strings.
   *
   * You should provide an implementation that resolves the DNS record accordingly.
   *
   * You must *at least* provide an implementation that resolves `TXT` records.
   * In which case, the DNS lookups are not guarnateed to use the authoritative name servers.
   *
   * #### Node.js
   *
   * In Node.js, you can use the [`node:dns`](https://nodejs.org/api/dns.html#dnspromisesresolvetxthostname) to implement the `resolveDns` option.
   *
   * @example
   * ```ts ignore
   * const resolveDns = (domain, recordType, options) => {
   *     const resolver = new require('node:dns').promises.Resolver();
   *     if (options?.nameServer?.ipAddr !== undefined) {
   *       resolver.setServers([options.nameServer.ipAddr]);
   *     }
   *     return resolver.resolve(domain, recordType);
   * };
   * ```
   */
  resolveDns?: ResolveDnsFunction;
  /**
   * The number of milliseconds to poll before giving up and throw an error. (Default: 30000)
   */
  timeout?: number;
};

/**
 * Lookup the DNS `TXT` record for `domain` every `interval`
 * (in ms, default: 5000) until the record matches `pollUntil`.
 *
 * The lookups are done using the Authoritative Name Server of the `domain`.
 *
 * Note: To avoid issues with DNS-01 challenges, consider waiting an additional
 * 15-30 seconds after this succeeds before submitting the challenge.
 *
 * @example
 * ```ts
 * import { pollDnsTxtRecord } from "@fishballpkg/acme/Dns01ChallengeUtils";
 *
 * await pollDnsTxtRecord({
 *  domain: "sub.example.com",
 *  pollUntil: "some-secret-text",
 *  onBeforeAttempt: () => {
 *    console.log(`Looking up DNS records...`);
 *  },
 *  onAfterFailAttempt: (recordss) => {
 *    for (const [i, records] of recordss.entries()) {
 *      console.log(`Record in Authoritative Name Server ${i}`);
 *      console.log(records);
 *    }
 *    console.log("Retrying later...");
 *  },
 * });
 *
 * // dns record verified!
 * ```
 */
export const pollDnsTxtRecord = async ({
  domain,
  pollUntil,
  interval = 5000,
  onAfterFailAttempt,
  onBeforeAttempt,
  resolveDns: resolveDnsProp,
  timeout = 30_000,
}: PollDnsTxtRecordConfig): Promise<void> => {
  const resolveDns = resolveDnsProp as (typeof Deno.resolveDns | undefined) ??
    Deno.resolveDns;

  const getAuthoritativeNameServerIps = async (
    domain: string,
  ): Promise<string[]> => {
    while (domain.includes(".")) { // continue the loop if we haven't reached TLD
      const nameServers = await (async () => {
        try {
          return await resolveDns(domain, "NS");
        } catch {
          return null;
        }
      })();

      if (nameServers === null) {
        domain = domain.slice(domain.indexOf(".") + 1);
        continue;
      }

      const ips = (await Promise.all(
        [
          ...nameServers.map(async (ns) => {
            try {
              return await resolveDns(ns, "A");
            } catch {
              return [];
            }
          }),
          ...nameServers.map(async (ns) => {
            try {
              return await resolveDns(ns, "AAAA");
            } catch {
              return [];
            }
          }),
        ],
      )).flat();

      return [...new Set(ips)];
    }

    return [];
  };

  const resolveDnsTxt = async (
    domain: string,
    nameServerIp?: string,
  ): Promise<string[]> => {
    const records = await resolveDns(
      domain,
      "TXT",
      nameServerIp === undefined ? undefined : {
        nameServer: { ipAddr: nameServerIp },
      },
    );

    return records.map((chunks) => chunks.join("")); // long txt are chunked
  };

  const timeoutTime = Date.now() + timeout;
  let latestRecordss: string[][] | undefined;
  while (Date.now() <= timeoutTime) {
    onBeforeAttempt?.();
    const authoritativeNameServerIps = await getAuthoritativeNameServerIps(
      domain,
    );

    latestRecordss = await Promise.all(
      authoritativeNameServerIps.length <= 0
        ? [resolveDnsTxt(domain)] // no authoritative NS found, just try looking up without it
        : authoritativeNameServerIps.map(
          async (publicNameserverIp) => {
            try {
              return await resolveDnsTxt(domain, publicNameserverIp);
            } catch {
              return [];
            }
          },
        ),
    );

    if (
      latestRecordss.every((records) => records.includes(pollUntil))
    ) {
      // successful!
      return;
    }

    onAfterFailAttempt?.(latestRecordss);
    await new Promise((res) => setTimeout(res, interval));
  }

  throw new Error(`Timeout: giving up on polling dns txt record
Latest records:
${JSON.stringify(latestRecordss, null, 2)}

Expected record: ${pollUntil}`);
};
