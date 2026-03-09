/**
 * A function that resolves DNS record.
 *
 * It should return an empty array when the requested record type has no
 * answers, and only throw for actual resolver failures such as transport,
 * configuration, or upstream server errors.
 */
export type ResolveDnsFunction = <R extends "A" | "AAAA" | "NS" | "TXT">(
  query: string,
  recordType: R,
) => Promise<"TXT" extends R ? string[][] : string[]>;
