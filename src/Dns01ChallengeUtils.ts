export const Dns01ChallengeUtils: {
  pollDnsTxtRecord: (payload: {
    domain: string;
    pollUntil: string;
    delay?: number;
    successfulVerifyRepeatTimes?: number;
    onBeforeEachAttempt?: () => void;
    onAfterFailAttempt?: (recordss: string[][]) => void;
  }) => Promise<void>;
} = {
  pollDnsTxtRecord: (() => {
    const getNameServerIps = async (domain: string): Promise<string[]> => {
      while (domain.includes(".")) { // continue the loop if we haven't reached TLD
        const nameServers = await (async () => {
          try {
            return await Deno.resolveDns(domain, "NS");
          } catch (e) {
            if (e instanceof Deno.errors.NotFound) {
              return null;
            }

            throw e;
          }
        })();

        if (nameServers === null) {
          domain = domain.slice(domain.indexOf(".") + 1);
          continue;
        }

        const ips = (await Promise.all(nameServers.map((ns) =>
          Deno.resolveDns(ns, "A")
        )))
          .flat();
        return ips;
      }

      throw new Deno.errors.NotFound(
        `Cannot find NS records for ${domain} and all its parent domain.`,
      );
    };

    const resolveDnsTxt = async (
      domain: string,
      nameServerIp: string,
    ): Promise<string[]> => {
      const records = await Deno.resolveDns(domain, "TXT", {
        nameServer: { ipAddr: nameServerIp },
      });

      return records.map((chunks) => chunks.join("")); // long txt are chunked
    };

    return async ({
      domain,
      pollUntil,
      delay = 5000,
      successfulVerifyRepeatTimes = 3,
      onAfterFailAttempt,
      onBeforeEachAttempt,
    }) => {
      let remainingVerifyTimes = successfulVerifyRepeatTimes;

      while (remainingVerifyTimes > 0) {
        if (remainingVerifyTimes === successfulVerifyRepeatTimes) {
          onBeforeEachAttempt?.();
        }
        const nameServerIps = await getNameServerIps(domain);

        const recordss = await Promise.all(
          nameServerIps.map(async (publicNameserverIp) =>
            await resolveDnsTxt(domain, publicNameserverIp)
          ),
        );

        if (recordss.every((records) => records.includes(pollUntil))) {
          remainingVerifyTimes--;
        } else {
          onAfterFailAttempt?.(recordss);
          remainingVerifyTimes = successfulVerifyRepeatTimes;
          await new Promise((res) => setTimeout(res, delay));
        }
      }
    };
  })(),
};
