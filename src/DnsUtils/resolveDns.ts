/**
 * A function that resolves DNS record.
 */
export type ResolveDnsFunction = <R extends "A" | "AAAA" | "NS" | "TXT">(
  query: string,
  recordType: R,
  options?: {
    /**
     * If true and the record type is `TXT`, the resolver may choose to query
     * all authoritative name servers and return only records observed in all
     * of them.
     */
    authoritative?: boolean;
    nameServer?: {
      ipAddr: string;
      port?: number;
    };
  },
) => Promise<"TXT" extends R ? string[][] : string[]>;
