# CHANGELOG

## 0.17.0

- Added `http-01` challenge support: get an `AcmeChallenge<"http-01">` via
  `findChallenge("http-01")`, then `getHttpResource()` returns the URL and the
  key authorization string to serve over HTTP.
  (https://github.com/fishballapp/acme/pull/33)
- `AcmeChallenge` is now generic over its challenge type (e.g.
  `AcmeChallenge<"dns-01">`). The type-specific helpers `getDnsRecordAnswer()`
  (dns-01) and `getHttpResource()` (http-01) live on `AcmeChallenge` and are
  only callable on the matching type. Use the new `AcmeChallenge.prototype.is`
  type guard (e.g. `if (challenge.is("dns-01")) { ... }`) to narrow a challenge;
  `findChallenge(type)` returns the precisely-typed challenge.
- Added `AcmeChallenge.prototype.keyAuthorization()`, the raw key authorization
  shared by the `dns-01` and `http-01` flows.
- Added `AcmeChallenge.prototype.getType()` to read the challenge type. The
  public `AcmeChallenge.prototype.type` property is now deprecated and will be
  made fully private in the next version — comparing it does not narrow the
  challenge; use `.is(...)` instead.
- Deprecated `AcmeAuthorization.prototype.findDns01Challenge()` in favour of
  `findChallenge("dns-01")`; it will be removed in the next version.
- BREAKING: `Dns01Challenge` is now a (deprecated) type alias for
  `AcmeChallenge<"dns-01">` rather than a class — `Dns01Challenge.from(...)` and
  `instanceof Dns01Challenge` no longer exist; use `findChallenge("dns-01")` and
  `challenge.is("dns-01")` to narrow. The alias will be removed in the next
  version.
- `AcmeAccount.prototype.keyRollover(...)` and
  `AcmeAccount.prototype.createOrder(...)` now throw `AcmeError` on failure
  instead of the raw parsed JSON response.
  (https://github.com/fishballapp/acme/pull/32)

## 0.16.0

- Added External Account Binding (EAB) support to
  `AcmeClient.prototype.createAccount(...)` via the optional
  `externalAccountBinding: { kid, hmacKey }` option, for CAs that require
  binding to an existing account (e.g. ZeroSSL, Google Trust Services, HARICA).
  (https://github.com/fishballapp/acme/pull/31)
- `AcmeDirectory` now exposes the CA's `meta` object; `createAccount(...)`
  throws early when `meta.externalAccountRequired` is set but no
  `externalAccountBinding` is provided.
- Internal: vendored a zero-dependency base64/base64url implementation
  (`src/utils/base64.ts`) from `@std/encoding`, replacing reliance on the native
  `Uint8Array` base64 methods.

## 0.15.0

- BREAKING: `AcmeWorkflows.requestCertificate(...)` now requires an explicit
  `resolveDns`.
- BREAKING: `DnsUtils.pollDnsTxtRecord(...)` now requires an explicit
  `resolveDns`; built-in authoritative nameserver discovery and `nameServerIps`
  were removed.
- Added runtime-specific DNS resolver entrypoints:
  - `@fishballpkg/acme/resolveDns.deno`
  - `@fishballpkg/acme/resolveDns.node`
  - `@fishballpkg/acme/resolveDns.doh`
- Added `DnsUtils.createUnanimousResolveDns([...])` for strict multi-resolver
  intersection.
- Added `dnsTimeout` to configure DNS TXT polling separately from ACME order
  polling timeout.

## 0.12.0

- Implemented `CryptoKeyUtils` with utility functions to help with exporting and
  importing of keys easily.

## 0.11.0

- Implemented `AcmeAccount.prototype.keyRollover`

## 0.10.0

- Added `CertUtils` module with `decodeValidity` function for finding out the
  starting and ending dates of the certificate

## 0.9.0

- BREAKING: create account now accepts `emails: string[]` instead of
  `email: string` to facilitate need for multiple emails.
  (https://github.com/fishballapp/acme/pull/10)
- Improve the [example cli](./examples/acme-cli.ts)
  (https://github.com/fishballapp/acme/pull/10)

## 0.8.0

- (Node.js) Added default implementation for `resolveDns` in `DnsUtils`
  functions.
