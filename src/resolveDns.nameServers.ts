/**
 * Common public DNS resolver configuration for:
 * - `@fishballpkg/acme/resolveDns.node`
 * - `@fishballpkg/acme/resolveDns.deno`
 * - `@fishballpkg/acme/resolveDns.doh`
 */
export const PUBLIC_DNS = {
  cloudflare: {
    ipv4: ["1.1.1.1", "1.0.0.1"],
    ipv6: ["2606:4700:4700::1111", "2606:4700:4700::1001"],
    doh: ["https://cloudflare-dns.com/dns-query"],
  },
  google: {
    ipv4: ["8.8.8.8", "8.8.4.4"],
    ipv6: ["2001:4860:4860::8888", "2001:4860:4860::8844"],
    doh: ["https://dns.google/resolve"],
  },
  quad9: {
    ipv4: ["9.9.9.9", "149.112.112.112"],
    ipv6: ["2620:fe::fe", "2620:fe::9"],
    doh: ["https://dns.quad9.net/dns-query"],
  },
} as const;

/**
 * Quick pick of commonly used public DNS resolver IPv4 addresses.
 */
export const RECOMMENDED_PUBLIC_DNS_IPS = [
  PUBLIC_DNS.cloudflare.ipv4[0],
  PUBLIC_DNS.google.ipv4[0],
  PUBLIC_DNS.quad9.ipv4[0],
] as const;

/**
 * Common public DNS resolver IPs grouped by provider.
 */
export const PUBLIC_DNS_IPS = {
  cloudflare: {
    ipv4: PUBLIC_DNS.cloudflare.ipv4,
    ipv6: PUBLIC_DNS.cloudflare.ipv6,
  },
  google: {
    ipv4: PUBLIC_DNS.google.ipv4,
    ipv6: PUBLIC_DNS.google.ipv6,
  },
  quad9: {
    ipv4: PUBLIC_DNS.quad9.ipv4,
    ipv6: PUBLIC_DNS.quad9.ipv6,
  },
} as const;

/**
 * DNS-over-HTTPS JSON endpoints known to work with
 * `@fishballpkg/acme/resolveDns.doh`.
 */
export const DOH_ENDPOINTS = {
  cloudflare: PUBLIC_DNS.cloudflare.doh[0],
  google: PUBLIC_DNS.google.doh[0],
} as const;
