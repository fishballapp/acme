import { TimeoutError } from "../errors.ts";
import { getIpVersion, getSupportedIpVersions } from "./_helpers.ts";
import { findAuthoritativeNameServerIps } from "./findAuthoritativeNameServerIps.ts";
import { defaultResolveDns, type ResolveDnsFunction } from "./resolveDns.ts";

/**
 * Config object for {@link pollDnsTxtRecord}
 */
export type PollDnsTxtRecordOptions = {
  /**
   * The contents of the `TXT` to stop polling.
   */
  pollUntil: string | string[];
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
   * A function to resolve DNS record.
   */
  resolveDns?: ResolveDnsFunction;
  /**
   * A list of IPv4 or IPv6 addresses that will be used for TXT lookups.
   *
   * If defined, {@link pollDnsTxtRecord} will not try to find the authoritative name server ips,
   * but instead use the given list of ips for the lookups.
   *
   * If not defined, {@link pollDnsTxtRecord} will try to use the IP addresses of the
   * authoritative name servers of the given domain using {@link findAuthoritativeNameServerIps}
   *
   * It is recommended to use the authoritative name server's ips of your domain.
   * You can use {@link findAuthoritativeNameServerIps} if you need to resolve them dynamically.
   *
   * Note: The given {@link PollDnsTxtRecordOptions.resolveDns} implementation must support
   * the `nameServer` options for this to work properly.
   *
   * If you'd like to use the systems defaults, you can pass `[]`.
   */
  nameServerIps?: string[];
  /**
   * The number of milliseconds to poll before giving up and throw an error. (Default: 30000)
   */
  timeout?: number;
};

/**
 * Lookup the DNS `TXT` record for `domain` every `interval`
 * (in ms, default: 5000) until the record matches `pollUntil`.
 *
 * The returned promise resolves only when the `pollUntil` value appear in *ALL* the
 * name servers, as specified in {@link PollDnsTxtRecordOptions.nameServerIps}.
 *
 * Note: To avoid issues with DNS-01 challenges, it is advisable waiting some additional
 * time after this succeeds before submitting the challenge to ensure DNS
 * records are propagated correctly.
 *
 * @example
 * ```ts
 * import {
 *   pollDnsTxtRecord,
 *   findAuthoritativeNameServerIps
 * } from "@fishballpkg/acme/DnsUtils";
 *
 * const domain = "subdomain.example.com"
 * await pollDnsTxtRecord(
 *   domain,
 *   {
 *     pollUntil: "expected txt content",
 *     onBeforeAttempt: () => {
 *       console.log(`Looking up DNS records...`);
 *     },
 *     onAfterFailAttempt: (recordss) => {
 *       for (const [i, records] of recordss.entries()) {
 *         console.log(`Record in Authoritative Name Server ${i}`);
 *         console.log(records);
 *       }
 *       console.log("Retrying later...");
 *     },
 *   },
 * );
 *
 * // dns record found!
 * ```
 */
export const pollDnsTxtRecord = async (
  /**
   * The domain to poll `TXT` record for.
   */
  domain: string,
  options: PollDnsTxtRecordOptions,
): Promise<void> => {
  const {
    resolveDns = defaultResolveDns,
    interval = 5000,
    onAfterFailAttempt,
    onBeforeAttempt,
    timeout = 30_000,
  } = options;
  const pollUntil = typeof options.pollUntil === "string"
    ? [options.pollUntil]
    : options.pollUntil;

  const [
    nameServerIps,
    supportedIpVersions,
  ] = await Promise.all([
    options.nameServerIps ??
      findAuthoritativeNameServerIps(domain, {
        resolveDns,
      }),
    getSupportedIpVersions(),
  ]);

  const supportedNameServerIps = nameServerIps.filter((ip) =>
    supportedIpVersions.includes(getIpVersion(ip))
  );

  if (
    options.nameServerIps !== undefined && options.nameServerIps.length > 0 &&
    supportedNameServerIps.length <= 0
  ) {
    throw new Error(
      "You have provided a list of name server ips, but none of that are supported by your system.",
    );
  }

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

    // latestRecordss contians records from each name server we test
    latestRecordss = await Promise.all(
      supportedNameServerIps.length <= 0
        ? [resolveDnsTxt(domain)] // no authoritative NS provided, just try looking up without it.
        : supportedNameServerIps.map(async (publicNameserverIp) => {
          try {
            return await resolveDnsTxt(domain, publicNameserverIp);
          } catch {
            return [];
          }
        }),
    );

    if (
      pollUntil.every((v) =>
        latestRecordss?.every((records) => records.includes(v))
      )
    ) {
      // successful!
      return;
    }

    onAfterFailAttempt?.(latestRecordss);
    await new Promise((res) => setTimeout(res, interval));
  }

  throw new TimeoutError(`Giving up on polling dns txt record
Latest records:
${JSON.stringify(latestRecordss, null, 2)}

Expected record: ${pollUntil}`);
};
