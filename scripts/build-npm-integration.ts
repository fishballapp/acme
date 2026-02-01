import { dntConfig } from "./build-npm.ts";
import { dnt } from "./scripts-deps.ts";

const config: dnt.BuildOptions = {
  ...dntConfig,
  testPattern: "integration/**/*.test.ts",
  test: true,
};

await dnt.build(config);
