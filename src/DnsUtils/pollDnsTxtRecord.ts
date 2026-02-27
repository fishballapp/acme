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
   * A callback that executes after each "fail" lookup, where no matching `TXT` record is found. It receives the `TXT` records found in this attempt from every authoritative name server.
   */
  onAfterFailAttempt?: (recordss: string[][]) => void;
  /**
   * A function to resolve DNS record.
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
 *   pollDnsTxtRecord
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
    resolveDns,
    interval = 5000,
    onAfterFailAttempt,
    onBeforeAttempt,
    timeout = 30_000,
  } = options;
  const pollUntil = typeof options.pollUntil === "string"
    ? [options.pollUntil]
    : options.pollUntil;

  const resolveDnsTxt = async (
    domain: string,
  ): Promise<string[]> => {
    const records = await resolveDns(
      domain,
      "TXT",
    );

    return records.map((chunks) => chunks.join("")); // long txt are chunked
  };

  const timeoutTime = Date.now() + timeout;
  let latestRecordss: string[][] | undefined;

  while (Date.now() <= timeoutTime) {
    onBeforeAttempt?.();

    // latestRecordss contians records from each name server we test
    try {
      latestRecordss = [await resolveDnsTxt(domain)];
    } catch {
      latestRecordss = [[]];
    }

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
