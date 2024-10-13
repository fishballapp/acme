export const isIpv6Supported = async (): Promise<boolean> => {
  try {
    await Deno.resolveDns("dns.google", "AAAA");
    return true;
  } catch {
    return false;
  }
};
