# Fishball ACME - Agent Guide

This document provides a detailed overview of the `@fishballpkg/acme` codebase
to assist AI agents (and humans) in understanding, modifying, and extending the
library.

## Architecture Overview

`@fishballpkg/acme` is a minimalist, zero-dependency ACME client written in
TypeScript. It is designed to be environment-agnostic (working in Deno, Node.js,
and browsers) by relying on standard Web APIs like `fetch` and `WebCrypto`.

### Core Components

1. **`AcmeClient` (`src/AcmeClient.ts`)**:
   - **Role**: The entry point. Handles connection to the ACME directory and
     account management.
   - **Key Responsibility**: Maintains the `nonce` queue and handles JWS (JSON
     Web Signature) wrapping for all network requests.
   - **Key Methods**: `init`, `createAccount`, `login`, `jwsFetch`.

2. **`AcmeAccount` (`src/AcmeAccount.ts`)**:
   - **Role**: Represents a registered account with the CA.
   - **Key Responsibility**: Creates new orders and manages account keys.
   - **Key Methods**: `createOrder`, `keyRollover`, `update`.

3. **`AcmeOrder` (`src/AcmeOrder.ts`)**:
   - **Role**: Represents a certificate request order.
   - **Key Responsibility**: Tracks the lifecycle of a request from creation ->
     challenge fulfillment -> finalization -> downloading certificate.
   - **Key Logic**: Maps input domains to the `AcmeAuthorization` objects
     returned by the server.

4. **`AcmeAuthorization` (`src/AcmeAuthorization.ts`)**:
   - **Role**: Represents the CA's requirement for you to prove control over a
     specific domain.
   - **Key Responsibility**: Holds the list of challenges (DNS, HTTP, etc.) that
     can be used to prove control.
   - **Nuance**: For wildcard domains (`*.example.com`), the authorization
     returned by the CA is for the _base_ domain (`example.com`) with a
     `wildcard: true` flag.

5. **`AcmeChallenge` & `Dns01Challenge` (`src/AcmeChallenge.ts`)**:
   - **Role**: Represents a specific proof mechanism (e.g., creating a DNS TXT
     record).
   - **Key Responsibility**: Generates the required token/key-authorization and
     instructions for the user (e.g., "Set TXT record at _acme-challenge...").

6. **Utilities**:
   - **`generateCSR.ts`**: Generates Certificate Signing Requests using raw
     ASN.1 encoding (no OpenSSL dependency).
   - **`jws.ts`**: Handles JSON Web Signature creation.
   - **`crypto.ts`**: Wrappers around WebCrypto API.

## Wildcard Support Implementation Details

Implementing wildcard support requires handling the discrepancy between how ACME
servers return wildcard authorizations and how the client maps them.

### The Mismatch Problem

1. **Order Creation**: Client requests order for `*.example.com`.
2. **Server Response**: Server returns authorization for identifier
   `example.com` (type `dns`), but adds `{ wildcard: true }` to the
   authorization object.
3. **Mapping Logic (`AcmeOrder.ts`)**: The client attempts to match the
   requested domain `*.example.com` against the authorization's identifier
   `example.com`. This fails without intervention.

### The Fix Strategy

1. **Normalize Authorization Domain**: In `AcmeAuthorization`, if
   `wildcard: true` is present, the exposed `.domain` property should imply the
   wildcard (e.g., prepend `*.`).
2. **Sanitize DNS Challenge Record**: The `Dns01Challenge` calculates the TXT
   record name as `_acme-challenge.${this.authorization.domain}.`.
   - If `.domain` includes `*.`, the record becomes
     `_acme-challenge.*.example.com`, which is **incorrect**.
   - RFC 8555 mandates the record be at `_acme-challenge.example.com` even for
     wildcards.
   - **Correction**: `Dns01Challenge` must strip the `*.` prefix when generating
     the record name.

## Testing Strategy

- **Integration Tests**: Use Pebble (Let's Encrypt's test server) via Docker.
- **End-to-End**: `e2e` folder contains tests against real staging environments
  (Cloudflare DNS + Let's Encrypt Staging).

## Common Pitfalls

- **Deno vs Node**: The codebase uses Deno-style imports (`.ts` extensions).
- **Crypto**: Everything uses `crypto.subtle`. Keys are P-256 ECDSA by default.
