/**
 * A function that resolves DNS record.
 *
 * #### Deno
 *
 * `Deno.resolveDns` will be used by default and you may omit `resolveDns`.
 *
 * #### Node.js
 *
 * In Node.js, you can use the [`node:dns`](https://nodejs.org/api/dns.html#dnspromisesresolvetxthostname)
 * to implement the `resolveDns` option.
 *
 * @example Example implementation for Node.js
 * ```ts ignore
 * const resolveDns = (domain, recordType, options) => {
 *     const resolver = new require('node:dns').promises.Resolver();
 *     if (options?.nameServer?.ipAddr !== undefined) {
 *       resolver.setServers([options.nameServer.ipAddr]);
 *     }
 *     return resolver.resolve(domain, recordType);
 * };
 * ```
 */
export type ResolveDnsFunction = (
  query: string,
  recordType: "A" | "AAAA" | "CNAME" | "NS",
  options?: {
    nameServer?: {
      ipAddr: string;
    };
  },
) => Promise<string[] | string[][]>;
