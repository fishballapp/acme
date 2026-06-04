# CHANGELOG

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
