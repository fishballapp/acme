export const generateRandomDomain = (): string => `${crypto.randomUUID()}.com`;

export const generateRandomEmail = (): string =>
  `${crypto.randomUUID()}@${crypto.randomUUID()}.com`;
