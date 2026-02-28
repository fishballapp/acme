/**
 * Common public DNS resolver configuration for:
 * - `@fishballpkg/acme/resolveDns.node`
 * - `@fishballpkg/acme/resolveDns.deno`
 * - `@fishballpkg/acme/resolveDns.doh`
 */
export const PUBLIC_DNS = {
  ips: {
    cloudflare: {
      primary: "1.1.1.1",
      secondary: "1.0.0.1",
      primaryIPv6: "2606:4700:4700::1111",
      secondaryIPv6: "2606:4700:4700::1001",
    },
    google: {
      primary: "8.8.8.8",
      secondary: "8.8.4.4",
      primaryIPv6: "2001:4860:4860::8888",
      secondaryIPv6: "2001:4860:4860::8844",
    },
    quad9: {
      primary: "9.9.9.9",
      secondary: "149.112.112.112",
      primaryIPv6: "2620:fe::fe",
      secondaryIPv6: "2620:fe::9",
    },
  },
  doh: {
    cloudflare: "https://cloudflare-dns.com/dns-query",
    google: "https://dns.google/resolve",
  },
} as const;

/**
 * Quick pick of commonly used public DNS resolver IPv4 addresses.
 */
export const RECOMMENDED_PUBLIC_DNS_IPS = [
  PUBLIC_DNS.ips.cloudflare.primary,
  PUBLIC_DNS.ips.google.primary,
  PUBLIC_DNS.ips.quad9.primary,
] as const;

/**
 * Common public DNS resolver IPs grouped by provider.
 */
export const PUBLIC_DNS_IPS = PUBLIC_DNS.ips;

/**
 * DNS-over-HTTPS JSON endpoints that work with this library.
 */
export const DOH_ENDPOINTS = PUBLIC_DNS.doh;
