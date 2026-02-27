import { TimeoutError } from "../errors.ts";
import type { ResolveDnsFunction } from "./resolveDns.ts";

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
   * A callback that executes after each "fail" lookup, where no matching `TXT` record is found.
   * It receives the `TXT` records found in this attempt.
   */
  onAfterFailAttempt?: (records: string[]) => void;
  /**
   * A function to resolve DNS record.
   *
   * Use `createResolveDns({ queryAuthoritativeNameServers: true })` from a
   * platform-specific resolver module (e.g. `@fishballpkg/acme/resolveDns.deno`)
   * to check authoritative nameservers during polling.
   */
  resolveDns: ResolveDnsFunction;
  /**
   * The number of milliseconds to poll before giving up and throw an error. (Default: 30000)
   */
  timeout?: number;
};

/**
 * Lookup the DNS `TXT` record for `domain` every `interval`
 * (in ms, default: 5000) until the record matches `pollUntil`.
 *
 * The behavior of the DNS lookup (e.g. querying authoritative nameservers)
 * is determined by the provided {@link PollDnsTxtRecordOptions.resolveDns} function.
 *
 * Note: To avoid issues with DNS-01 challenges, it is advisable waiting some additional
 * time after this succeeds before submitting the challenge to ensure DNS
 * records are propagated correctly.
 *
 * @example
 * ```ts
 * import { pollDnsTxtRecord } from "@fishballpkg/acme/DnsUtils";
 * import { createResolveDns } from "@fishballpkg/acme/resolveDns.deno";
 *
 * const resolveDns = createResolveDns({ queryAuthoritativeNameServers: true });
 *
 * const domain = "subdomain.example.com"
 * await pollDnsTxtRecord(
 *   domain,
 *   {
 *     resolveDns,
 *     pollUntil: "expected txt content",
 *     onBeforeAttempt: () => {
 *       console.log(`Looking up DNS records...`);
 *     },
 *     onAfterFailAttempt: (records) => {
 *       console.log("Found records:", records);
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
    resolveDns,
    interval = 5000,
    onAfterFailAttempt,
    onBeforeAttempt,
    timeout = 30_000,
  } = options;
  const pollUntil = typeof options.pollUntil === "string"
    ? [options.pollUntil]
    : options.pollUntil;

  const timeoutTime = Date.now() + timeout;
  let latestRecords: string[] | undefined;

  while (Date.now() <= timeoutTime) {
    onBeforeAttempt?.();

    try {
      const records = await resolveDns(domain, "TXT");
      latestRecords = records.map((chunks) => chunks.join("")); // long txt are chunked
    } catch {
      latestRecords = [];
    }

    if (pollUntil.every((v) => latestRecords?.includes(v))) {
      // successful!
      return;
    }

    onAfterFailAttempt?.(latestRecords);
    await new Promise((res) => setTimeout(res, interval));
  }

  throw new TimeoutError(`Giving up on polling dns txt record
Latest records:
${JSON.stringify(latestRecords, null, 2)}

Expected record: ${pollUntil}`);
};
