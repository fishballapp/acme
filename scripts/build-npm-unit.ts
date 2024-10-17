import { build, type BuildOptions } from "jsr:@deno/dnt";
import { dntConfig } from "./build-npm.ts";

const config: BuildOptions = {
  ...dntConfig,
  testPattern: "src/**/!(*.deno).test.ts",
  test: true,
};

await build(config);
