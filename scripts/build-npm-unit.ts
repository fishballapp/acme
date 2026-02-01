import { dntConfig } from "./build-npm.ts";
import { dnt } from "./scripts-deps.ts";

const config: dnt.BuildOptions = {
  ...dntConfig,
  testPattern: "src/**/!(*.deno).test.ts",
  test: true,
};

await dnt.build(config);
