let isIpv6SupportedPromise: Promise<boolean> | undefined;

export const isIpv6Supported = async (): Promise<boolean> => {
  isIpv6SupportedPromise ??= (async () => {
    try {
      await Deno.resolveDns("github.com", "NS", {
        nameServer: {
          ipAddr: "2001:4860:4860::8888",
        },
      });
      return true;
    } catch {
      return false;
    }
  })();

  return await isIpv6SupportedPromise;
};
