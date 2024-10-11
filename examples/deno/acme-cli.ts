import {
  ACME_DIRECTORY_URLS,
  AcmeClient,
  Dns01ChallengeUtils,
} from "@fishballpkg/acme";
import { runAcmeCli } from "../shared/run-acme-cli.mjs";

await runAcmeCli({
  EMAIL: "dev@dynm.link",
  DOMAIN: "dynm.link",
  ACME_DIRECTORY_URLS,
  AcmeClient,
  Dns01ChallengeUtils,
  /**
   * use Deno's alert
   * @see https://docs.deno.com/api/web/~/alert
   */
  alert: alert,
  /**
   * No need to specify resolveDns, you can omit this prop when calling {@link Dns01ChallengeUtils.pollDnsTxtRecord}
   */
  resolveDns: undefined,
});
