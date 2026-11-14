# Task 34 follow-up: remove PostgreSQL from the Netlify proxy

Completed repository fix on 14 November 2026. Hosted deployment acceptance remains
open; this note does not establish a successful Netlify deploy.

## Problem and change

The reported Edge bundler failure named `pg-587764f78a6c7a9c`. The import chain was
`src/proxy.ts -> auth/middleware.ts -> db/request-limits.ts -> db/index.ts -> pg`.
`pg` already exists in production dependencies. Next.js 16 Proxy already uses
Node.js; Netlify nevertheless packages Node middleware in its Edge wrapper.
Adding old experimental middleware flags or server externals does not remove
this import chain.

Proxy now calls `/api/internal/request-limit` over HTTP at the fixed configured
`APP_ORIGIN`. That Node route owns PostgreSQL access. A purpose-separated HMAC
using the existing server-only Clerk secret authenticates the scope, hashed
identity, and timestamp. The route validates the fields, checks a 30-second
freshness window, and compares signatures in constant time before querying.
It does not read a request body or accept client credentials as identity.

The exact internal route bypasses Clerk/locale/admission to prevent recursion;
the route authenticates itself. All business routes retain Clerk-verified
identities, shared PostgreSQL budgets, authentication checks before Clerk proxy
short-circuits, safe 429/Retry-After responses, and fail-closed 503s. The client
rejects redirects, times out after five seconds, and validates decisions.
No dependencies, migrations, allowance values, or new environment variables.

Changed files: `src/auth/middleware.ts`, its two existing test files,
`src/auth/proxy-boundary.test.ts`, `src/auth/request-limit-transport.test.ts`,
`src/request-limits/{client,protocol}.ts`,
`src/app/api/internal/request-limit/route.ts`, `src/db/request-limits.ts`,
`docs/staging-setup.md`, and this handoff. The pre-existing formatting change in
`scripts/test-database.mjs` was preserved and excluded from delivery.

## Test-first and review evidence

- Baseline focused tests: 25 passed; baseline Next build passed.
- RED (`84a41ac`): `npm run test -- src/auth/proxy-boundary.test.ts` failed because
  the real transitive proxy imports included `pg`. The transport suite initially
  failed because the new transport did not exist.
- GREEN: all 146 focused auth/admission tests passed after the boundary change.
  Tests exercise real client-to-handler signing with a mocked database, malformed,
  forged, stale, future and tampered admissions, denied decisions, transport/store
  errors, redaction, response validation, and recursion prevention.
- Pre-validation review applied REVIEW.md and Ponytail review to the complete
  task diff, proxy/Clerk/GT callers, Node route, HMAC protocol, database consumer,
  existing admission tests and deployment instructions. Checked scope/identity
  derivation, SSRF/redirect exposure, request-body handling, signature verification,
  freshness, fail-closed errors, logging, unchanged database transactions and
  business authorization. No unresolved must-fix findings.
- Validation found a test-only `HeadersInit` inference error; explicitly typed the
  fixture, reviewed the correction, and reran lint, typecheck and build successfully.

## Final verification

- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`: passed.
- Tests: 76 files / 903 tests passed; 15 files / 272 opt-in database cases skipped.
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities.
- Built middleware's `.nft.json`: no `pg`, `pg-pool`, `pg-connection-string`, or
  `pg-protocol` driver files among its 115 traced files.
- Built production HTTP smoke on loopback, with deliberately unreachable
  placeholder PostgreSQL and nonfunctional Clerk keys: unsigned admission POST
  returned uncached 404; a valid signed admission reached the store and returned
  503; GET `/sign-in` traversed proxy -> HTTP -> Node handler and returned safe
  503 with Retry-After 5 and a fresh correlation ID, without recursion or secret
  disclosure. Temporary server stopped; no live provider or database was used.
- `git diff --check`: passed.

## Limitations and exact next task

The extra HTTP call adds latency and depends on `APP_ORIGIN` reaching this exact
deployment without redirects or site-access challenges. Preview deployments must
have isolated origins and provider configuration; keep them disabled until set up.
Signatures are short-lived credentials; never log or publish admission headers.
Replays within the freshness window can consume only the signed bucket, never
authorize a business action. Existing anonymous buckets remain shared.

Netlify Edge packaging, hosted sign-in/cookies, database integration/E2E, backups,
restore and alerts were not verified by this fix. No coverage dependency or new
test infrastructure was added. No merge or live deployment performed.

**Next task:** review/merge this PR, retry Netlify with the exact stable HTTPS
`APP_ORIGIN`, and verify successful Edge bundling, `/health`, unsigned admission
404s, signed-in writes, 429/retry and controlled store-failure 503 behavior. Then
continue Task 34's hosted synthetic workflow and recovery/alert acceptance checks
in [the staging checklist](../staging-setup.md).

Sources: [Netlify runtime and middleware limitations](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/),
[Next.js Proxy runtime](https://nextjs.org/docs/app/api-reference/file-conventions/proxy),
and installed Next.js 16.4.2 Proxy/Route Handler guides. Context7 documentation was
queried for the Netlify adapter and Next.js 16 APIs.
