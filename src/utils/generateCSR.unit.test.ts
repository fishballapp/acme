import { describe, encodeBase64, expect, it } from "../../test_deps.ts";
import { generateKeyPair } from "./crypto.ts";
import { generateCSR } from "./generateCSR.ts";

async function cryptoKeyToPem(key: CryptoKey) {
  const isPrivateKey = key.type === "private";
  const exportFormat = isPrivateKey ? "pkcs8" : "spki";

  const exported = await globalThis.crypto.subtle.exportKey(exportFormat, key);

  const base64String = encodeBase64(exported);

  return formatPEM(isPrivateKey ? "PRIVATE KEY" : "PUBLIC KEY", base64String);
}

const chunkString = (s: string, length: number): string[] => {
  if (s.length <= length) return [s];
  return [s.slice(0, length), ...chunkString(s.slice(length), length)];
};

const formatPEM = (name: string, data: string) => {
  const pemBody = chunkString(data, 64).join("\n");
  return `-----BEGIN ${name}-----\n${pemBody}\n-----END ${name}-----`;
};

async function exec(
  bin: string,
  args: string[],
  stdin?: string,
): Promise<{ stdout: string; stderr: string }> {
  const command = new Deno.Command(bin, {
    args,
    stdout: "piped",
    stderr: "piped",
    stdin: stdin === undefined ? "null" : "piped",
  });

  const process = command.spawn();

  if (stdin !== undefined) {
    const writer = process.stdin.getWriter();
    await writer.write(new TextEncoder().encode(stdin));
    writer.close();
  }

  const { stdout, stderr, code } = await process.output();

  if (code !== 0) {
    console.log(new TextDecoder().decode(stdout));
    console.error(new TextDecoder().decode(stderr));
    throw new Error(`OpenSSL command failed`);
  }

  return {
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
}

const openssl = {
  generateCSR: async ({ domains, privateKey }: {
    domains: string[];
    privateKey: CryptoKey;
  }) => {
    return (
      await exec(
        "openssl",
        [
          "req",
          "-new",
          "-key",
          "/dev/stdin",
          "-subj",
          `/CN=${domains[0]}`,
          "-addext",
          `subjectAltName="${
            domains.map((domain) => `DNS:${domain}`).join(",")
          }"`,
        ],
        await cryptoKeyToPem(privateKey),
      )
    ).stdout;
  },
  getCSRInfo: async (csrPem: string): Promise<string> => {
    return (
      await exec(
        "openssl",
        ["req", "-in", "-", "-noout", "-text"],
        csrPem,
      )
    ).stdout;
  },

  verifyCSR: async (csrPem: string): Promise<string> => {
    const { stdout, stderr } = await exec(
      "openssl",
      ["req", "-in", "-", "-verify", "-noout"],
      csrPem,
    );
    return stdout || stderr; // strage issue with -verify https://github.com/openssl/openssl/issues/20728
  },
};

const removeSignatureValueFromCSRInfo = (csrInfo: string) =>
  csrInfo.replace(/(?<=Signature Value:).*/gmsu, "");

// Testing CSR generation
describe("generateCSR", () => {
  it("should generate CSR as expected", async () => {
    const domain = "example.com";
    const { privateKey, publicKey } = await generateKeyPair();

    const generatedCSR = formatPEM(
      "CERTIFICATE REQUEST",
      encodeBase64(
        await generateCSR({
          domains: ["example.com"],
          keyPair: {
            privateKey,
            publicKey,
          },
        }),
      ),
    );

    // Compare the relevant CSR content (excluding the signature as it changes every time)
    expect(
      removeSignatureValueFromCSRInfo(await openssl.getCSRInfo(generatedCSR)),
    ).toBe(
      removeSignatureValueFromCSRInfo(
        await openssl.getCSRInfo(
          await openssl.generateCSR({ domains: [domain], privateKey }),
        ),
      ),
    );

    // Verify the OpenSSL CSR signature
    expect(
      await openssl.verifyCSR(generatedCSR),
    ).toContain("verify OK");
  });

  it("should generate CSR for multi-domain as expected", async () => {
    const domains = ["example.com", "www.example.com", "example2.com"];
    const { privateKey, publicKey } = await generateKeyPair();

    const generatedCSR = formatPEM(
      "CERTIFICATE REQUEST",
      encodeBase64(
        await generateCSR({
          domains,
          keyPair: {
            privateKey,
            publicKey,
          },
        }),
      ),
    );

    // Compare the relevant CSR content (excluding the signature as it changes every time)
    expect(
      removeSignatureValueFromCSRInfo(await openssl.getCSRInfo(generatedCSR)),
    ).toBe(
      removeSignatureValueFromCSRInfo(
        await openssl.getCSRInfo(
          await openssl.generateCSR({ domains, privateKey }),
        ),
      ),
    );

    // Verify the OpenSSL CSR signature
    expect(
      await openssl.verifyCSR(generatedCSR),
    ).toContain("verify OK");
  });
});
