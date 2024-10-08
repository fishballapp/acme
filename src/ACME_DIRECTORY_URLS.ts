export const ACME_DIRECTORY_URLS = {
  BUYPASS: "https://api.buypass.com/acme/directory",
  BUYPASS_STAGING: "https://api.test4.buypass.no/acme/directory",
  GOOGLE: "https://dv.acme-v02.api.pki.goog/directory",
  GOOGLE_STAGING: "https://dv.acme-v02.test-api.pki.goog/directory",
  LETS_ENCRYPT: "https://acme-v02.api.letsencrypt.org/directory",
  LETS_ENCRYPT_STAGING:
    "https://acme-staging-v02.api.letsencrypt.org/directory",
  ZEROSSL: "https://acme.zerossl.com/v2/DV90",
} as const;
