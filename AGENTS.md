# AGENTS.md

This file provides guidance to AI Agents when working with code in this
repository.

## Project Overview

`@fishballpkg/acme` is a zero-dependency, minimalistic, opinionated ACME client
written in TypeScript. It is designed to be platform-agnostic, running on Deno,
Node.js, and other modern JavaScript environments that support `WebCrypto` and
`fetch`.

## Development Commands

This project uses Deno for development.

### Testing

There are multiple tiers of tests in this repository:

- **Unit Tests**: Run purely in-process, mocking external requests where
  necessary.
  - Command: `deno task test:unit`
  - Location: `src/**/*.test.ts`

- **Integration Tests**: Run against a local Pebble instance (Let's Encrypt's
  ACME test server).
  - **Prerequisites**: Docker must be running.
  - **Start Pebble**: `deno task pebble:start` (starts Pebble and `challtestsrv`
    via Docker Compose)
  - **Run Integration Tests**: `deno task test:integration`
  - **Stop Pebble**: `deno task pebble:stop`
  - Location: `integration/`

- **E2E Tests**:
  - Command: `deno task test:e2e`
  - Location: `e2e/`

### Building

The project is natively TypeScript/Deno but builds to NPM for Node.js
compatibility using `dnt`.

- **Build for NPM**: `deno task build:npm`
  - This script (`scripts/build-npm.ts`) generates the `dist-npm` directory.

### Linting & Formatting

- **Lint**: Use `deno lint` standard command.
- **Format**: Use `deno fmt` standard command.

## High-Level Architecture

The codebase follows the hierarchy of the ACME standard (RFC 8555).

### Core Components (`src/`)

- **Entry Point**: `src/mod.ts` exports the public API.
- **AcmeClient** (`src/AcmeClient.ts`): The main entry point for users.
  Initializes with a directory URL.
  - **JWS Signing**: Handles JSON Web Signature (JWS) wrapping for requests
    using `src/utils/jws.ts` and `src/utils/crypto.ts`.
  - **Nonce Management**: detailed in `AcmeClient` private methods.
- **AcmeAccount** (`src/AcmeAccount.ts`): Represents a registered account on the
  ACME server.
- **AcmeOrder** (`src/AcmeOrder.ts`): Represents a certificate order. Handles
  polling for status steps.
- **AcmeAuthorization** (`src/AcmeAuthorization.ts`): Represents validation for
  a specific domain.
- **AcmeChallenge** (`src/AcmeChallenge.ts`): Represents a specific challenge
  method (e.g., `dns-01`).

### Utilities

- **`src/utils/`**: Internal helpers.
  - `jws.ts`: JWS signing logic.
  - `crypto.ts`: WebCrypto wrappers.
  - `generateCSR.ts`: Logic to generate valid Certificate Signing Requests (CSR)
    without external dependencies like OpenSSL.
- **`src/ACME_DIRECTORY_URLS.ts`**: Constants for common ACME directories (Let's
  Encrypt, etc.).

### Workflows

- **`src/AcmeWorkflows.ts`**: Contains high-level abstraction functions (e.g.,
  `requestCertificate`) that bundle multiple steps (order creation, challenge
  solving, polling, finalization) into single calls for convenience.

## Design Principles

1. **Zero Dependencies**: Do not introduce NPM dependencies or external CLIs
   (like OpenSSL). Everything must be implemented using standard Web APIs
   (`WebCrypto`, `fetch`) or built from scratch (like the CSR generator).
2. **Platform Agnostic**: Code must write to Deno standards but be compatible
   with Node.js via the build script. Avoid Deno-specific namespaces (`Deno.*`)
   in the `src/` directory unless strictly necessary or valid polyfills exist.
3. **Opinionated**: Focus on `DNS-01` challenge and `ECDSA P-256` keys. Support
   for other methods is secondary.
