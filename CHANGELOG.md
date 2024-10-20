# CHANGELOG

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
