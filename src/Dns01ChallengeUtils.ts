/**
 * Lookup the DNS `TXT` record for `domain` every `interval`
 * (in ms, default: 5000) until the record matches `pollUntil`.
 *
 * The lookups are done with the Authoritative Name Server of the `domain`.
 *
 * - `onBeforeAttempt` is called before *each* DNS lookup happens.
 * - `onAfterFailAttempt` is called after *each* failed lookup, where no matching
 *    `TXT` record is found. It receives the `TXT` records found in this attempt
 *    from every authoritative name server.
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
 *
 * ### For Deno
 *
 * There is no need to pass the `resolveDns` option. `Deno.resolveDns` will be used by default.
 *
 * ----------
 *
 * ### For Other Platforms
 *
 * `pollDnsTxtRecord` performs lookup on 3 record types:
 * - `NS`: Used to find out the authoritative name servers of your domain.
 *   - Expected return type `Promise<string[]>`
 * - `A`: Used to find out the IP addresses of your authoritative name servers.
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
 * @see https://nodejs.org/api/dns.html#dnspromisesresolvetxthostname
 *
 * In Node.js, you can use the `node:dns` module to implement the `resolveDns` option.
 *
 * @example Node.js
 * ```ts ignore
 * const resolveDns = (domain, recordType, options) => {
 *     const resolver = new require('node:dns').promises.Resolver();
 *     if (options?.nameServer?.ipAddr) {
 *         resolver.setServers([options?.nameServer?.ipAddr]);
 *     }
 *     switch (recordType) {
 *         case 'A':
 *             return resolver.resolve(domain);
 *         case 'TXT':
 *             return resolver.resolveTxt(domain);
 *         case 'NS':
 *             return resolver.resolveNs(domain);
 *     }
 * };
 * ```
 *
 * Or if you prefer a simpler implementation, and don't care about
 * which name server you resolve the TXT record from, you could use:
 *
 * @example
 * ```ts ignore
 * const resolveDns = (domain, recordType) => {
 *     if (recordType !== 'TXT') {
 *         throw new Error('any error would mean not found, message is ignored');
 *     }
 *     return new require('node:dns').promises.resolveTxt(domain);
 * };
 * ```
 */
export const pollDnsTxtRecord = async ({
  domain,
  pollUntil,
  interval = 5000,
  onAfterFailAttempt,
  onBeforeAttempt,
  /** */
  resolveDns: resolveDnsProp,
}: {
  domain: string;
  pollUntil: string;
  interval?: number;
  onBeforeAttempt?: () => void;
  onAfterFailAttempt?: (recordss: string[][]) => void;
  resolveDns?: (query: string, recordType: string, options?: {
    nameServer?: {
      ipAddr: string;
    };
  }) => Promise<string[] | string[][]>;
}): Promise<void> => {
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

      const ips = (await Promise.all(nameServers.map(async (ns) => {
        try {
          return await resolveDns(ns, "A");
        } catch {
          return [];
        }
      }))).flat();

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

  while (true) {
    onBeforeAttempt?.();
    const authoritativeNameServerIps = await getAuthoritativeNameServerIps(
      domain,
    );

    const recordss = await Promise.all(
      authoritativeNameServerIps.length <= 0
        ? [resolveDnsTxt(domain)] // no authoritative NS found, just try looking up without it
        : authoritativeNameServerIps.map(
          async (publicNameserverIp) =>
            await resolveDnsTxt(domain, publicNameserverIp),
        ),
    );

    if (
      recordss.every((records) => records.includes(pollUntil))
    ) {
      // successful!
      return;
    }

    onAfterFailAttempt?.(recordss);
    await new Promise((res) => setTimeout(res, interval));
  }
};
