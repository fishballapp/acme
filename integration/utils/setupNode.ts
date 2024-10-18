import { isNode } from "../../test_deps.ts";

export const setupNode = () => {
  if (isNode) {
    // @ts-ignore: node specific
    globalThis["process"]["env"]["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
  }
};
