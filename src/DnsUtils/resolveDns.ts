/**
 * A function that resolves DNS records.
 *
 * The `nameServer` option is resolver-dependent. Native DNS resolvers
 * (Deno, Node.js) support it to query specific nameservers directly.
 * DoH resolvers may ignore it as they route through a resolver service.
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
