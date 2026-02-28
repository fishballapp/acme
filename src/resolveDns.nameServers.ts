/**
 * Common public DNS resolver IP addresses for `createResolveDns({ nameServer })`
 * in `@fishballpkg/acme/resolveDns.node` and
 * `@fishballpkg/acme/resolveDns.deno`.
 */
export const PUBLIC_DNS_IP_CLOUDFLARE = "1.1.1.1";
export const PUBLIC_DNS_IP_CLOUDFLARE_SECONDARY = "1.0.0.1";
export const PUBLIC_DNS_IP_CLOUDFLARE_IPV6 = "2606:4700:4700::1111";
export const PUBLIC_DNS_IP_CLOUDFLARE_IPV6_SECONDARY = "2606:4700:4700::1001";

export const PUBLIC_DNS_IP_GOOGLE = "8.8.8.8";
export const PUBLIC_DNS_IP_GOOGLE_SECONDARY = "8.8.4.4";
export const PUBLIC_DNS_IP_GOOGLE_IPV6 = "2001:4860:4860::8888";
export const PUBLIC_DNS_IP_GOOGLE_IPV6_SECONDARY = "2001:4860:4860::8844";

export const PUBLIC_DNS_IP_QUAD9 = "9.9.9.9";
export const PUBLIC_DNS_IP_QUAD9_SECONDARY = "149.112.112.112";
export const PUBLIC_DNS_IP_QUAD9_IPV6 = "2620:fe::fe";
export const PUBLIC_DNS_IP_QUAD9_IPV6_SECONDARY = "2620:fe::9";

/**
 * Quick pick of commonly used public DNS resolver IPv4 addresses.
 */
export const RECOMMENDED_PUBLIC_DNS_IPS = [
  PUBLIC_DNS_IP_CLOUDFLARE,
  PUBLIC_DNS_IP_GOOGLE,
  PUBLIC_DNS_IP_QUAD9,
] as const;

/**
 * Common public DNS resolver IPs grouped by provider.
 */
export const PUBLIC_DNS_IPS = {
  cloudflare: {
    primary: PUBLIC_DNS_IP_CLOUDFLARE,
    secondary: PUBLIC_DNS_IP_CLOUDFLARE_SECONDARY,
    primaryIPv6: PUBLIC_DNS_IP_CLOUDFLARE_IPV6,
    secondaryIPv6: PUBLIC_DNS_IP_CLOUDFLARE_IPV6_SECONDARY,
  },
  google: {
    primary: PUBLIC_DNS_IP_GOOGLE,
    secondary: PUBLIC_DNS_IP_GOOGLE_SECONDARY,
    primaryIPv6: PUBLIC_DNS_IP_GOOGLE_IPV6,
    secondaryIPv6: PUBLIC_DNS_IP_GOOGLE_IPV6_SECONDARY,
  },
  quad9: {
    primary: PUBLIC_DNS_IP_QUAD9,
    secondary: PUBLIC_DNS_IP_QUAD9_SECONDARY,
    primaryIPv6: PUBLIC_DNS_IP_QUAD9_IPV6,
    secondaryIPv6: PUBLIC_DNS_IP_QUAD9_IPV6_SECONDARY,
  },
} as const;
