/**
 * A function that resolves DNS record.
 */
export type ResolveDnsFunction = <R extends "A" | "AAAA" | "NS" | "TXT">(
  query: string,
  recordType: R,
  options?: {
    /**
     * If true, and the recordType is "TXT", the resolver will attempt to resolve from all
     * authoritative name servers and only return records present in all of them.
     */
    authoritative?: boolean;
    nameServer?: {
      ipAddr: string;
      port?: number;
    };
  },
) => Promise<"TXT" extends R ? string[][] : string[]>;
