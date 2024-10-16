# CHANGELOG

## 0.9.0

- BREAKING: create account now accepts `emails: string[]` instead of
  `email: string` to facilitate need for multiple emails.
  (https://github.com/fishballapp/acme/pull/10)
- Improve the [example cli](./examples/acme-cli.ts)
  (https://github.com/fishballapp/acme/pull/10)

## 0.8.0

- (Node.js) Added default implementation for `resolveDns` in `DnsUtils`
  functions.
