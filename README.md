# @fishballpkg/acme

> This package is still under active development. Feel free to experiment with
> it and I would love to hear your feedback.

`@fishballpkg/acme` is a zero-dependency, minimalistic, opiniated Automatic
Certificate Management Environment (ACME) client written in TypeScript from
scratch. We aim to simplify certificate generation by removing the need to deal
with cryptographic options, external tools like OpenSSL, or other low-level
details.

This client makes obtaining a certificate for your domain easy. The steps can be
broken down to:

1. Create an account with the Certificate Authority (CA)
2. Place an order to the CA
3. Complete the DNS-01 challenge
4. Get your certificate

This client is intentially INFLEXIBLE. No freedom of choice over encryption
algorithms, key sizes, certificates attributes, key formats. We have made most
of the choices for you. So that you can focus on what actually matters, your
application.

## Supported Platforms

This is built primarily for Deno.

But since this is built in 100% TypeScript with no dependencies, it should be
compatible with all modern JavaScript platforms that support the [WebCrypto] and
[fetch]. (One exception being `Dns01ChallengeUtils.pollDnsTxtRecord()` which
make use of `Deno.resolveDns`, perhaps we can make this take in a `resolveDns`
function later to make this platform agnostic.)

## Features

- Zero Dependencies: Built from the ground up in TypeScript, with no external
  dependencies AT ALL.
- Minimalistic Design: Focuses on a small, essential feature set to keep things
  lightweight and manageable.
- Unapologetically OPINIONATED, so you don’t have to be.
  - Keys are created with [ECDSA P-256], a modern standard in creating
    encryption keys.
  - The only challenge we support is [DNS-01 Challenge], the most versatile
    challenge type in our opinion. This challenge type works for any service,
    supports wildcard certificates, and avoids complex server configurations by
    operating at the DNS level.

[ECDSA P-256]: https://en.wikipedia.org/wiki/Elliptic_Curve_Digital_Signature_Algorithm
[DNS-01 Challenge]: https://datatracker.ietf.org/doc/html/rfc8555#section-8.4

## Why?

While building a multi-tenant SaaS with Deno, I noticed that many services
offering multi-tenancy impose restrictive certificate generation quotas for
custom domains. I was hesitant to pay for what should essentially be a free
service, so I decided to create my own solution.

Though many third-party tools and libraries handle this, I wanted something that
stayed entirely within the Deno environment without needing to call into the
shell.

Existing JavaScript ACME clients felt outdated and unnecessarily complex, with
some relying on custom encryption implementations that seemed both inefficient
and insecure.

So, I built my own ACME client in TypeScript, leveraging modern JavaScript
features like [WebCrypto] and [fetch] to keep things clean, simple, and
efficient.

[fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
[WebCrypto]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API

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

## Roadmap

- [ ] Account
  - [x] Creation
  - [ ] Update
  - [ ] Key Rollover
  - [ ] Recovery
- [ ] Challenges
  - [x] DNS-01
  - ~~[ ] HTTP-01~~
  - ~~[ ] TLS-ALPN-01~~
- [ ] Certificate Management
  - [x] CSR Generation
  - [x] Certificate Issuance
  - [x] Multi-Domain Certificates via SAN
  - [ ] Wildcard Certificates
  - [ ] Renewal
  - [ ] Revocation
- [ ] Key and Algorithm Support
  - [x] ECDSA P-256
  - ~~[ ] RSA~~
- [ ] ACME Server Interaction
  - [x] ACME Directory Support (staging, production)
  - [ ] Error Handling and Retries
- [ ] Client Usability
  - [ ] CLI
  - [ ] REST API? (REST ENCRYPT? 😂)
  - [ ] Plugin?

## Brief introduction to ACME process and our APIs

We have built a [simple CLI tool](./examples/acme-cli.ts) that would allow you
to obtain a certificate by following the steps of ACME.

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

### 0x02: Create an account and place an order

```ts
// ...

const account = await acmeClient.createAccount({ email: "yo@fishball.app" });
const order = await account.createOrder({
  domains: ["fishball.app"],
});
```

To create an account with the CA, you must provide an email address. Although
this is not required by the ACME specification and some CAs, it is generally
considered a good practice to do so as it allows the CA to reach out for
important notifications, such as certificate expiration reminders or policy
changes.

You can provide multiple domains when creating an order. The first domain in the
list will be used in the Common Name (CN) of the certificate and the whole list
of domains (including the first) would be used in Subject Alternative Name (SAN)
field of the certificate. This allows the certificate you obtain later to work
for all those domains.

### 0x03: Get the authorizations and challenges

```ts
// ...

const authorizations = await order.getAuthorizations();

const challenges = authorizations.map((authorization) =>
  authorization.findChallenge("dns-01")
);
```

Authorizations in an order represent "ways you can prove control over the
domains in the order". For each domain you provide, you will get an
authorization object. You can call `authorization.findChallenge("dns-01")` which
get the `dns-01` challenge. You can also find challenges of different types, but
as mentioned above, there's no intention to support other types at the moment.

The challenge object contains information about the challenge, most noticeably
the `token` value, accessible via `challenge.challengeObject.token`. This is the
value that'll be "digested" later to produce a value you put into your DNS TXT
record.

### 0x04: Get the digested token for your DNS TXT record

```ts
// ...
const txtRecordContent = await challenge.digestToken();
```

This method would produce a digested token. It is the value you should put into
your DNS `TXT` record for `_acme-challenge.your.domain.com`.

This value is computed with
`encodeBase64Url(sha256(token + "." + publicKeyJWKThumbprint))`, as outlined in
[RFC8555](https://datatracker.ietf.org/doc/html/rfc8555#section-8.1).

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

const csrKeyPair = await order.finalize();
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
available at `csrKeyPair.privateKey`.

### 0x06: Download your CERTIFICATE!!!!

```ts
//...

await order.pollStatus({ pollUntil: "valid" });

const certificatePemContent = await order.getCertificate();
```

After finalizing the order, poll for order status `valid`. Once it's valid, the
certificate is ready to be fetched! Simply call `await order.getCertificate()`

## Secret Pride 🤫

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
