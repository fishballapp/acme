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
   * Delay (ms) between DNS lookup attempts.
   *
   * Default: `5000`
   */
  interval?: number;
  /**
   * Maximum duration (ms) to keep polling before failing.
   *
   * Default: `600000` (10 minutes)
   */
  pollingWindow?: number;
  /**
   * A callback that executes before each DNS lookup.
   */
  onBeforeAttempt?: () => void;
  /**
   * A callback that executes after each "fail" lookup, where no matching `TXT`
   * record is found. It receives all `TXT` records returned for this attempt.
   */
  onAfterFailAttempt?: (recordss: string[][]) => void;
  /**
   * A function to resolve DNS record.
   */
  resolveDns: ResolveDnsFunction;
};

/**
 * Lookup the DNS `TXT` record for `domain` until the record matches
 * `pollUntil`.
 *
 * The returned promise resolves only when every expected `pollUntil` value
 * appears in the records returned by the provided resolver.
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
 * import { resolveDns } from "@fishballpkg/acme/resolveDns.deno";
 *
 * const domain = "subdomain.example.com"
 * await pollDnsTxtRecord(
 *   domain,
 *   {
 *     pollUntil: "expected txt content",
 *     resolveDns,
 *     onBeforeAttempt: () => {
 *       console.log(`Looking up DNS records...`);
 *     },
 *     onAfterFailAttempt: (recordss) => {
 *       console.log(recordss);
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
    interval = DEFAULT_INTERVAL,
    pollingWindow = DEFAULT_POLLING_WINDOW,
    onAfterFailAttempt,
    onBeforeAttempt,
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

  const timeoutTime = Date.now() + pollingWindow;
  let latestRecordss: string[][] | undefined;

  while (Date.now() <= timeoutTime) {
    onBeforeAttempt?.();

    // latestRecordss contains records returned by resolveDns in this attempt.
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

const DEFAULT_INTERVAL = 5_000;
const DEFAULT_POLLING_WINDOW = 10 * 60_000;
