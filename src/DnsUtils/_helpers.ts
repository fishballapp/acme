import { defaultResolveDns, type ResolveDnsFunction } from "./resolveDns.ts";

type IpVersion = "ipv4" | "ipv6";

const QUAD9_DNS_IPS: Record<IpVersion, string> = {
  ipv4: "9.9.9.9",
  ipv6: "2620:fe::fe",
};

const cache: Record<IpVersion, Promise<boolean> | undefined> = {
  ipv4: undefined,
  ipv6: undefined,
};

const isIpVersionSupported = async (
  version: IpVersion,
  {
    resolveDns = defaultResolveDns,
  }: {
    resolveDns?: ResolveDnsFunction;
  } = {},
): Promise<boolean> => {
  cache[version] ??= (async () => {
    try {
      await resolveDns("example.com", "NS", {
        nameServer: {
          ipAddr: QUAD9_DNS_IPS[version],
        },
      });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  })();

  return await cache[version];
};

export const getSupportedIpVersions = async (
  opts: { resolveDns?: ResolveDnsFunction } = {},
): Promise<
  readonly IpVersion[]
> => {
  const [ipv4Supported, ipv6Supported] = await Promise.all([
    isIpVersionSupported("ipv4", opts),
    isIpVersionSupported("ipv6", opts),
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
