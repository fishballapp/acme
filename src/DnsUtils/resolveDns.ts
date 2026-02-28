/**
 * A function that resolves DNS record.
 */
export type ResolveDnsFunction = <R extends "A" | "AAAA" | "NS" | "TXT">(
  query: string,
  recordType: R,
) => Promise<"TXT" extends R ? string[][] : string[]>;
