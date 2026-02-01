const FISHBALL_SUBDOMAIN = "test.acme.pkg.fishball.dev";

export const randomFishballTestingSubdomain = () => {
  return `${crypto.randomUUID()}.${FISHBALL_SUBDOMAIN}`.toLowerCase();
};
