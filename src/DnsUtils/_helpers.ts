type IpVersion = "ipv4" | "ipv6";

const GOOGLE_DNS_IPS: Record<IpVersion, string> = {
  ipv4: "8.8.8.8",
  ipv6: "[2001:4860:4860::8888]",
};

const cache: Record<IpVersion, Promise<boolean> | undefined> = {
  ipv4: undefined,
  ipv6: undefined,
};

const isIpVersionSupported = async (
  version: IpVersion,
): Promise<boolean> => {
  cache[version] ??= (async () => {
    try {
      // not the best solution tbh, but I haven't found a better way to check if the network supports ipv4/6
      await fetch(`https://${GOOGLE_DNS_IPS[version]}`, {
        method: "head",
        redirect: "manual",
      });
      return true;
    } catch (e) {
      return false;
    }
  })();

  return await cache[version];
};

export const getSupportedIpVersions = async (): Promise<
  readonly IpVersion[]
> => {
  const [ipv4Supported, ipv6Supported] = await Promise.all([
    isIpVersionSupported("ipv4"),
    isIpVersionSupported("ipv6"),
  ]);

  if (ipv4Supported && ipv6Supported) {
    return ["ipv4", "ipv6"];
  }

  if (ipv4Supported) {
    return ["ipv4"];
  }

  if (ipv6Supported) {
    return ["ipv6"];
  }

  throw new Error(
    "Your system doesn't seem to be able to connect to the network...",
  );
};

export const getIpVersion = (ip: string): IpVersion => {
  // assume ip is either ipv4 or ipv6 string
  if (ip.includes(":")) return "ipv6";
  if (ip.includes(".")) return "ipv4";

  throw new Error("expect ip to be an ipv4 or ipv6");
};
