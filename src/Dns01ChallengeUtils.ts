/**
 * @module Dns01ChallengeUtils
 *
 * Some utility functions to help you with dns-01 challenge.
 */

/**
 * Lookup the DNS `TXT` record for `domain` every `interval`
 * (in ms, default: 5000) until the record matches `pollUntil`.
 *
 * @example
 * ```ts
 * import { pollDnsTxtRecord } from "@fishballpkg/acme/Dns01ChallengeUtils"
 * ```
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
 */
export const pollDnsTxtRecord: (payload: {
  domain: string;
  pollUntil: string;
  interval?: number;
  onBeforeAttempt?: () => void;
  onAfterFailAttempt?: (recordss: string[][]) => void;
}) => Promise<void> = (() => {
  const getAuthoritativeNameServerIps = async (
    domain: string,
  ): Promise<string[]> => {
    while (domain.includes(".")) { // continue the loop if we haven't reached TLD
      const nameServers = await (async () => {
        try {
          return await Deno.resolveDns(domain, "NS");
        } catch (e) {
          if (e instanceof Deno.errors.NotFound) {
            return null;
          }

          throw e;
        }
      })();

      if (nameServers === null) {
        domain = domain.slice(domain.indexOf(".") + 1);
        continue;
      }

      const ips = (await Promise.all(nameServers.map((ns) =>
        Deno.resolveDns(ns, "A")
      )))
        .flat();
      return ips;
    }

    throw new Deno.errors.NotFound(
      `Cannot find NS records for ${domain} and all its parent domain.`,
    );
  };

  const resolveDnsTxt = async (
    domain: string,
    nameServerIp: string,
  ): Promise<string[]> => {
    const records = await Deno.resolveDns(domain, "TXT", {
      nameServer: { ipAddr: nameServerIp },
    });

    return records.map((chunks) => chunks.join("")); // long txt are chunked
  };

  return async ({
    domain,
    pollUntil,
    interval = 5000,
    onAfterFailAttempt,
    onBeforeAttempt,
  }) => {
    while (true) {
      onBeforeAttempt?.();
      const authoritativeNameServerIps = await getAuthoritativeNameServerIps(
        domain,
      );

      const recordss = await Promise.all(
        authoritativeNameServerIps.map(async (publicNameserverIp) =>
          await resolveDnsTxt(domain, publicNameserverIp)
        ),
      );

      if (recordss.every((records) => records.includes(pollUntil))) {
        // successful!
        return;
      }

      onAfterFailAttempt?.(recordss);
      await new Promise((res) => setTimeout(res, interval));
    }
  };
})();
