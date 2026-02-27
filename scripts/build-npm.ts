import DENO_JSON from "../deno.json" with { type: "json" };
import { dnt, path } from "./scripts-deps.ts";

const { build, emptyDir } = dnt;
const { join } = path;

const PROJECT_ROOT = join(
  import.meta.dirname ?? (() => {
    throw new Error("no dirname");
  })(),
  "..",
);

const OUT_DIR = join(
  PROJECT_ROOT,
  "./dist-npm",
);

const GITHUB_REPO = "https://github.com/fishballapp/acme";

export const dntConfig: dnt.BuildOptions = {
  entryPoints: Object.entries(DENO_JSON.exports).map(([name, path]) => ({
    kind: "export",
    name,
    path: join(PROJECT_ROOT, path),
  })),
  outDir: OUT_DIR,
  test: false,
  shims: {
    deno: "dev",
    undici: "dev",
  },
  typeCheck: false,
  package: {
    name: DENO_JSON.name,
    version: DENO_JSON.version,
    description:
      "A zero-dependency, minimalist ACME client in TypeScript that simplifies certificate generation with built-in defaults and no cryptographic complexity.",
    license: "MIT",
    repository: {
      type: "git",
      url: `git+${GITHUB_REPO}.git`,
    },
    bugs: {
      url: `${GITHUB_REPO}/issues`,
    },
    keywords: ["acme"],
    homepage: "https://jsr.io/@fishballpkg/acme/doc",
    engines: {
      node: ">=25",
    },
  },
  mappings: {
    [`${PROJECT_ROOT}/src/DnsUtils/resolveDns.deno.ts`]:
      `${PROJECT_ROOT}/src/DnsUtils/resolveDns.node.ts`,
  },
  postBuild() {
    // steps to run after building and before running the tests
    for (const fileToCopy of ["LICENSE", "README.md"]) {
      Deno.copyFileSync(
        join(PROJECT_ROOT, fileToCopy),
        join(OUT_DIR, fileToCopy),
      );
    }

    Deno.writeTextFileSync(join(OUT_DIR, ".npmrc"), "engine-strict=true\n");
  },
};

if (import.meta.main) {
  await emptyDir(OUT_DIR);
  await build(dntConfig);
}
