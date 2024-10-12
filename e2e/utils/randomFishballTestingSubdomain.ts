const FISHBALL_SUBDOMAIN = "test.acme.pkg.fishball.xyz";

export const randomFishballTestingSubdomain = () => {
  return `${crypto.randomUUID()}.${FISHBALL_SUBDOMAIN}`.toLowerCase();
};
