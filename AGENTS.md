# AGENTS.md - fishball-acme

This is the ACME client library for Deno/Node.js. Used by Fishball Ltd for certificate automation.

## Quick Start

- **Language:** TypeScript
- **Runtime:** Deno (primary), Node.js (via DNT build)
- **Package Manager:** Deno
- **Build:** `deno task build` (compiles to NPM)
- **Test:** `deno task test` (unit tests), `deno task test:e2e` (integration tests with Pebble/Cloudflare)

## Key Files

- `src/mod.ts` — Main export
- `src/AcmeClient.ts` — Entry point for ACME protocol
- `src/AcmeAccount.ts` — Account management
- `src/AcmeOrder.ts` — Certificate orders
- `src/AcmeAuthorization.ts` — Domain authorizations
- `src/AcmeChallenge.ts` — Challenge solving (DNS-01)
- `integration/` — Pebble staging tests
- `e2e/` — Real certificate tests (Cloudflare)

## Development Workflow

1. **Branch naming:** `feat/feature-name` or `fix/bug-name`
2. **Linting:** `deno lint` (auto-fixes available with `--fix`)
3. **Type checking:** Integrated into Deno CLI
4. **Testing:**
   - Unit: `deno task test`
   - Integration (Pebble): `deno task test:integration`
   - E2E (Cloudflare): `deno task test:e2e`
5. **Commits:** Clear, descriptive messages (e.g., `feat: add wildcard support`)
6. **PRs:** Link to related issues with `Fixes #N`

## DNS-01 Challenge Solving

The library handles DNS validation via `Dns01Challenge.getDnsRecordAnswer()`. Key behavior:

- For wildcard domains (e.g., `*.example.com`), the challenge token is placed at `_acme-challenge.example.com` (no wildcard prefix in the record name).
- The `AcmeAuthorization` detects the `wildcard: true` flag in the ACME response and reconstructs the full domain with `*.` prefix.
- `AcmeChallenge.getDnsRecordAnswer()` strips the `*.` prefix before generating the DNS record name.

## CI/CD

- **Lint & Type Check:** `ci.yaml` (on every commit)
- **Integration Tests:** `integration.yaml` (on main + PRs)
- **E2E Tests:** `e2e.yaml` (on main + PRs, requires Cloudflare secrets)

## Notable Libraries

- **Deno:** Standard library for crypto, DNS, file I/O
- **DNT:** Converts Deno code to NPM packages
- **Pebble:** ACME staging server (for testing)
- **Cloudflare:** Real DNS provider (for E2E tests)

## Common Tasks

### Running Tests Locally

```bash
# Unit tests
deno task test

# Integration tests (requires local Pebble instance, see integration/README.md)
deno task test:integration

# E2E tests (requires CLOUDFLARE_API_KEY and CLOUDFLARE_ZONE_ID env vars)
CLOUDFLARE_API_KEY=xxx CLOUDFLARE_ZONE_ID=yyy deno task test:e2e
```

### Building for NPM

```bash
deno task build
# Output: `npm/` directory with compiled package
```

### Checking for Issues

```bash
deno lint         # Linting
deno check        # Type checking
deno fmt --check  # Format check
```

## Notes

- Always `git push` after local commits to keep the remote in sync.
- Use `deno-lint-ignore` comments sparingly; prefer fixing root causes.
- Wildcard support is a first-class feature; test both `example.com` and `*.example.com` in new DNS tests.
