export const setupNode = () => {
  if ("process" in globalThis) {
    // @ts-ignore: node specific
    globalThis["process"]["env"]["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
  }
};
