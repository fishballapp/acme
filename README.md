# @fishballpkg/acme

[![JSR](https://jsr.io/badges/@fishballpkg/acme)](https://jsr.io/@fishballpkg/acme)
[![NPM](https://img.shields.io/npm/v/@fishballpkg/acme.svg)](https://www.npmjs.com/package/@fishballpkg/acme)

[![CI](https://github.com/fishballapp/acme/actions/workflows/ci.yaml/badge.svg)](https://github.com/fishballapp/acme/actions/workflows/ci.yaml)
[![Integration](https://github.com/fishballapp/acme/actions/workflows/integration.yaml/badge.svg)](https://github.com/fishballapp/acme/actions/workflows/integration.yaml)
[![E2E](https://github.com/fishballapp/acme/actions/workflows/e2e.yaml/badge.svg)](https://github.com/fishballapp/acme/actions/workflows/e2e.yaml)
[![Publish](https://github.com/fishballapp/acme/actions/workflows/publish.yaml/badge.svg)](https://github.com/fishballapp/acme/actions/workflows/publish.yaml)

`@fishballpkg/acme` is a zero-dependency, minimalistic, opiniated Automatic
Certificate Management Environment (ACME) client written in TypeScript from
scratch.

> Disclaimer: By using this client, you agree to the terms of service of the
> organisation associated with your selected ACME directory, including any
> additional or future terms of service.

## Example

Run this [example CLI tool] to generate a certificate for your domain with Let's
Encrypt (Staging):

```
deno run --allow-net https://raw.githubusercontent.com/fishballapp/acme/refs/heads/main/examples/acme-cli.ts
```

We highly recommend you to try this example out. It will help you familiarize
with the basic steps of retrieving a certificate from the ACME server. (And
because I spent a lot of time crafting that CLI example...)

## What is ACME?

In simple words, ACME is the IETF standard
([RFC 8555](https://datatracker.ietf.org/doc/html/rfc8555)) for automating the
generation of SSL/TLS certificates for your HTTPS network.

## Features

While there are plenty of capable ACME clients available, most suffer from a few
common drawbacks: they’re often tightly bound to system dependencies,
complicated to set up, and limited support for programmatic control. This makes
it difficult for developers to integrate them into modern, automated workflows
or to use them in lightweight, flexible environments like serverless platforms
or containers.

This package solves these issues by offering an ACME client with the following
key features:

- **Zero Dependencies**: This client runs in any modern JavaScript environment
  without requiring external tools or libraries—just install and use.
- **Opinionated by Design**: The package is designed to work out of the box,
  with no complex setup required.
  - Modern cryptography: Encryption keys are generated using [ECDSA P-256], a
    secure, widely supported industry standard.
  - [DNS-01 Challenge] only: We focus on the DNS-01 challenge type, which we
    believe is the most versatile. It works for all services, supports wildcard
    certificates, and eliminates complex server configurations by operating at
    the DNS level.
- **Programmatic API**: Seamless integration with your codebase, offering
  flexible, easy-to-use programmatic controls.

[ECDSA P-256]: https://en.wikipedia.org/wiki/Elliptic_Curve_Digital_Signature_Algorithm
[DNS-01 Challenge]: https://datatracker.ietf.org/doc/html/rfc8555#section-8.4

This package simplifies this process by removing the need to deal with
cryptographic options, external tools like OpenSSL, or other low-level details.

## Supported Platforms

`@fishballpkg/acme` is built primarily in Deno. But it works out-of-the-box for
both Deno and Node.js.

Since `fishballpkg/acme` is built in 100% TypeScript with no external
dependencies whatsoever, it is compatible with all modern JavaScript platforms
that support the [WebCrypto] and [fetch].

## Who is this for?

This package is for you if you are:

- A **developer** who loves building applications but doesn’t want to get bogged
  down by low-level details.
- A **minimalist** who appreciates clean, efficient solutions with no
  unnecessary complexity.
- A **tech enthusiast** passionate about using the latest, most modern
  technologies.
- An **explorer** eager to try new approaches and experiment with fresh ideas.
- An **adventurer** willing to take risks for the possibility of an exciting and
  rewarding experience.
- A **multi-tenant SaaS creator** looking for a simple, customizable way to
  handle certificate generation without hitting quota limits.

## Brief introduction to ACME process and the APIs

The [example CLI tool] and the [integration tests](./integration/) should give
you a good overview of the APIs.

Here is a summary of the steps and API involved:

### 0x00: Add @fishballpkg/acme

```bash
$ deno add @fishballpkg/acme
```

Run the above command to add this package to your `deno.json`.

### 0x01: Initialize the client

```ts
import { ACME_DIRECTORY_URLS, AcmeClient } from "@fishballpkg/acme";

const acmeClient = await AcmeClient.init(
  ACME_DIRECTORY_URLS.LETS_ENCRYPT_STAGING,
);
```

This step fetches the ACME directory from your given URL. An [ACME directory] is
like a menu for ACME client, instructing the client where to create account,
where to place an order etc.

While you can provide any ACME directory, we've included a few well-known ones
in the [`ACME_DIRECTORY_URLS` object](./src/ACME_DIRECTORY_URLS.ts).

[ACME directory]: https://datatracker.ietf.org/doc/html/rfc8555#section-7.1

### 0x02: Create an account

```ts
// ...

const account = await acmeClient.createAccount({ emails: ["yo@fishball.app"] });
```

To create an account with the CA, you must provide an email address. Although
this is not required by the ACME specification and some CAs, it is generally
considered a good practice to do so as it allows the CA to reach out for
important notifications, such as certificate expiration reminders or policy
changes.

### 0x03: Create order and get the challenges

```ts
// ...

const order = await account.createOrder({
  domains: ["fishball.app"],
});

const dns01Challenges = order.authorizations.map((authorization) =>
  authorization.findDns01Challenge()
);
```

You can provide multiple domains when creating an order. The first domain in the
list will be used in the Common Name (CN) of the certificate and the whole list
of domains (including the first) would be used in Subject Alternative Name (SAN)
field of the certificate. This allows the certificate you obtain later to work
for all those domains.

> **Wildcard domains:** You can request wildcard certificates by including
> `*.example.com` in your domain list. Note that when using DNS-01 challenges
> for wildcards, the DNS record is still placed at `_acme-challenge.example.com`
> (without the `*.` prefix).

`AcmeOrder#authorizations` represent "your proof of control over the domains in
the order". For each domain you provide, you will get an authorization object.

`authorization.findDns01Challenge()` finds you the `dns-01` challenge in that
authorization.

### 0x04: Find out how to update your DNS record

```ts
// ...
const {
  type, // "TXT"
  name, // "_acme-challenge.yourdomain.com"
  content, // A string value to put into your DNS record to prove your control over the domain.
} = await dns01Challenge.getDnsRecordAnswer();
// or
const txtRecordContent = await dns01Challenge.digestToken();
```

These 2 methods basically does the same thing, except `.getDnsRecordAnswer()`
provides slightly more guidance on how to the DNS record should be set up.

### 0x05: Submit challenges and finalize it!

```ts
// updated DNS record

await challenge.submit();

await order.pollStatus({
  pollUntil: "ready",
  onBeforeAttempt: () => {
    console.log("this runs before every attempt");
  },
  onAfterFailAttempt: () => {
    console.log("this runs after every fail attempt");
  },
});

const certKeyPair = await order.finalize();
```

Once you have updated your DNS record according to the
`await challenge.digestToken()`, you can now submit the challenge!

After submitting the challenge, you can use `acmeOrder.pollStatus()` to ensure
your order is `"ready"`, meaning that the CA has verified your challenge.

Once the order status is `"ready"`, finalize the order by calling
`order.finalize()`. Under the hood, a
[Certificate Signing Request (CSR)](https://datatracker.ietf.org/doc/html/rfc2986)
is generated and submit it to the CA. The CA would then verify and sign it,
that's your certificate.

The private key for the CSR / the certificate you are going to obtain is
available at `certKeyPair.privateKey`.

### 0x06: Download your CERTIFICATE!!!!

```ts
//...

await order.pollStatus({ pollUntil: "valid" });

const certificatePemContent = await order.getCertificate();

const {
  notBefore, // You cannot use your cert before this dates.
  notAfter, // You cannot use your cert after this date.
} = CertUtils.decodeValidity(certificatePemContent);
```

After finalizing the order, poll for order status `valid`. Once it's valid, the
certificate is ready to be fetched! Simply call `await order.getCertificate()`

## Workflows

Workflows are some predefined common patterns to interact with the ACME client.

### `requestCertificate`

This workflow will perform these steps:

1. Create a new order
2. Set the dns records required for the challenges
3. Poll the dns until the records are verified
4. Submit the challenge
5. Poll until the order is `ready`
6. Finalize the order by submitting a Certificate Signing Request (CSR)
7. Poll until the order is `valid`
8. Retrieve the certificate

This workflow essentially bundles step `0x02` all the way to `0x06` in 1
function call.

```ts
import {
  ACME_DIRECTORY_URLS,
  AcmeClient,
  AcmeOrder,
  AcmeWorkflows,
} from "@fishballpkg/acme";

const client = await AcmeClient.init(
  ACME_DIRECTORY_URLS.LETS_ENCRYPT_STAGING,
);

const acmeAccount = await client.createAccount({ email: EMAIL });

const {
  certificate,
  certKeyPair,
  acmeOrder,
} = await AcmeWorkflows.requestCertificate({
  acmeAccount,
  domains: DOMAINS,
  updateDnsRecords: async (dnsRecords) => {
    // ... update dns records
  },
});

console.log(certificate); // Logs the certificate in PEM format
```

## Roadmap

- [x] Account
  - [x] Creation (`AcmeClient#createAccount`)
    - [ ] External Account Binding (Maybe? Submit an issue if you'd like this?)
  - [x] Retrieval (`AcmeClient#login`)
  - [x] Update contacts
  - [x] Key Rollover
- [x] Challenges
  - [x] DNS-01
  - [ ] ~~HTTP-01~~
  - [ ] ~~TLS-ALPN-01~~
- [x] Certificate Management
  - [x] CSR Generation
  - [x] Certificate Issuance
  - [x] Multi-Domain Certificates via SAN
  - [x] Wildcard Certificates
  - [ ] Revocation
- [x] Key and Algorithm Support
  - [x] ECDSA P-256
  - [ ] ~~RSA~~
- [x] ACME Server Interaction
  - [x] ACME Directory Support (staging, production)
  - [x] Bad Nonce Retries
- [ ] Client Usability
  - [x] Programmatic API
  - [ ] CLI
  - [ ] REST API? (REST ENCRYPT? 😂)
  - [ ] Plugin?

## 🤫

I have to admit — though I suppose it's no longer a secret — I'm particularly
proud of the CSR generation. It's something I never imagined myself
implementing, but after hours of deep-diving into ASN.1 syntax, countless
trial-and-error attempts, and reading through hundreds of octets, here we are!

What's even more exciting is that the CSR we generate is virtually identical to
the one produced by openssl. In fact, we compare the CSR we generate to the one
generated by openssl in our tests. You can find out more
[here](./src/utils/generateCSR.test.ts).

## Author

YCM Jason

## License

MIT

[example CLI tool]: https://github.com/fishballapp/acme/blob/main/examples/acme-cli.ts
[fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
[WebCrypto]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API
