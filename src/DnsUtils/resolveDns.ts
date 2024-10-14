/**
 * A function that resolves DNS record.
 */
export type ResolveDnsFunction = <R extends "A" | "AAAA" | "NS" | "TXT">(
  query: string,
  recordType: R,
  options?: {
    nameServer?: {
      ipAddr: string;
      port?: number;
    };
  },
) => Promise<"TXT" extends R ? string[][] : string[]>;

export { resolveDns as defaultResolveDns } from "./resolveDns.deno.ts";
