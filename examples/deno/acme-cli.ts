import { ACME_DIRECTORY_URLS, AcmeClient, DnsUtils } from "@fishballpkg/acme";
import { runAcmeCli } from "../shared/run-acme-cli.mjs";

await runAcmeCli({
  EMAIL: "dev@fishball.xyz",
  DOMAIN: "fishball.xyz",
  ACME_DIRECTORY_URLS,
  AcmeClient,
  DnsUtils,
  /**
   * use Deno's alert
   * @see https://docs.deno.com/api/web/~/alert
   */
  alert: alert,
  /**
   * No need to specify resolveDns, you can omit this prop when calling {@link DnsUtils.pollDnsTxtRecord}
   */
  resolveDns: undefined,
});
