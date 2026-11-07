# Task 31 — Shared request limits and mutation abuse controls

Date: 7 November 2026. Acceptance and local verification complete; ready for PR review.
Source: [Task 31](../agent-sized-build-plan.md#31--add-rate-limits-and-mutation-abuse-controls),
[request contract](../api-conventions.md#request-admission-contract),
[security operations](../security.md#request-abuse-controls).

## Completed acceptance

- Every path matches the Node.js proxy, including extension-looking and framework
  paths. Unsafe methods (everything except GET/HEAD/OPTIONS) check admission before
  action dispatch. The existing tenant, permission, current-membership, input and
  financial transaction boundaries remain authoritative.
- Signed-in requests share 60 admissions per verified Clerk user per 60-second
  window across routes, actions, sessions and organizations. Unsigned mutations
  share a separate 30-admission window. Client headers, cookies, organization IDs,
  action IDs and request UUIDs cannot choose an alternate admission identity.
- Authentication entrances share 60 admissions per window: sign-in GETs and unsafe
  sign-in/`/__clerk` requests are checked before Clerk's Frontend API proxy can
  short-circuit the app callback. Unsafe sign-in requests reaching the application
  also check their verified mutation/anonymous budget, preventing an alternate
  action URL from bypassing user limits. Neither budget is counted twice.
- Atomic PostgreSQL upsert/returning uses the database clock, starts a fixed
  60-second window at first admission, saturates counters at allowance + 1, and
  resets expired rows without extending a denied window. Separate transactions
  commit admission before business work; failed submissions and durable replays
  count as attempts. Two-second statement and 500ms lock timeouts fail closed.
- At most 100 other counters expired for more than a day are removed per attempt,
  with an expiry index and `FOR UPDATE SKIP LOCKED`. The current expired row is
  excluded from cleanup and reset by its own upsert. Stored keys are versioned
  Clerk-secret HMACs; no raw user identity, IP, cookie or financial input is stored.
- Denials stop before action dispatch with safe HTTP 429 JSON, a server-generated
  reference, `Retry-After`, and `Cache-Control: no-store`. Storage failure returns
  safe HTTP 503 with a five-second retry hint and redacted `request_limit_failed`
  diagnostics. Ordinary denials do not generate unexpected-failure logs.
- Existing receipt/payment request fingerprints, same-tenant UUID uniqueness,
  organization locks and authority-before-replay behavior were inspected and
  reverified. Matching retries replay; changed payloads conflict; concurrent
  duplicates post once; posting failures roll back. No domain gap required a
  change to those financial services.

## Choice and operating limits

Applied Product Lens to the accepted pilot scope: protect the purchasing and cash
recording workflow without adding another infrastructure service. Search-first
research compared installed PostgreSQL primitives, `rate-limiter-flexible` and
Netlify edge controls. The existing Drizzle/pg stack supports this small shared
counter directly, so no dependency, external account or environment variable was
added. Context7 and installed Next.js 16.4.2 guides informed proxy/response APIs;
Drizzle documentation informed the atomic write. Installed Clerk code confirmed
its Frontend API proxy can return before the callback.

Anonymous clients deliberately share budgets because no deployed trusted client-IP
boundary is established. One client can consume capacity for other anonymous
clients; these are coarse one-business-pilot controls. Forwarding headers are not
trusted. Verify the hosting adapter's client-IP boundary and provider/perimeter
controls during Task 34 before wider use. Clerk-domain requests bypass this app
and retain provider controls. Clerk asset/session GETs are not counted.

Fixed windows allow boundary bursts, and even denied attempts query PostgreSQL.
The controls are not DDoS protection, provider spending caps, authorization or
financial idempotency. Pool connection acquisition/provider outages can outlast
the query timeouts. Secret rotation changes effective bucket identities. Day-old
rows remain while the app is idle; traffic resumes bounded cleanup.

HTTP rejection uses the established Next.js route recovery when a hydrated action
client receives a non-action response; it adds no inline countdown/action-state
variant and does not promise to retain an unmounted form. After a delay, reuse an
uncertain submission's original UUID and unchanged payload; inspect recorded
history before entering a new transaction. Rejection itself performs no business
mutation. Live authenticated browser behavior remains separate acceptance.

## Migration and changed files

Apply additive `0017_request_rate_limits.sql` before deploying the application.
It adds only `request_rate_limits` (scope/key primary key, bounded hits, UTC reset,
checks and expiry index), with matching generated snapshot/journal. The runtime
needs SELECT/INSERT/UPDATE/DELETE on this operational table. Business/audit-table
permissions do not change. Code rollback needs no table removal; leave migration
history intact and use forward migrations for later schema corrections.

- `src/db/request-limits.ts`, `.test.ts`, `.integration.test.ts`: shared store,
  atomic/parameterized write, concurrency, expiry, cleanup, rollback and timeout tests.
- `src/db/schema/index.ts`, `drizzle/0017_request_rate_limits.sql`,
  `drizzle/meta/0017_snapshot.json`, `drizzle/meta/_journal.json`: operational schema.
- `src/auth/middleware.ts`, `middleware.test.ts`, `request-limits.test.ts`,
  `src/proxy.ts`: pre-Clerk and verified-user admission, responses, actual matcher,
  identity/header isolation and retained GT correlation/body composition.
- `src/diagnostics/server.ts`: allowlisted redacted counter-failure event.
- `.github/workflows/ci.yml`: include the new opt-in PostgreSQL suite in the
  existing disposable verification job.
- Build plan, documentation index, architecture, API conventions, security,
  deployment, testing and this handoff: contracts, rollout requirements, evidence
  and exact next task.

## Pre-validation review

Applied Ponytail review to the whole task diff and connected Clerk/GT composition,
financial services, diagnostics, schema/migration, callers and tests. Main-agent
review found that sign-in action POSTs also need the verified mutation budget;
fixed and regression-tested it before final checks. A bounded read-only GPT-6 Luna
review checked matcher bypasses, Clerk short-circuits, verified identities,
arbitrary unsafe action URLs, database atomicity/cleanup, safe failures and replay
risks; it found no concrete issues. Parent rechecked the final contention/cleanup
tests, CI and documentation. No unresolved must-fix findings.

## Verification

- Baseline focused auth/receipt/payment unit suites: 63 tests passed.
- Test-first RED: 12 HTTP-boundary tests failed on missing admission/429/503, and
  the store suite failed on its missing module. Checkpoint `f7bc488`.
  GREEN: the same targets plus financial unit suites passed 82 tests; seven initial
  isolated counter cases and all 62 receipt/payment PostgreSQL cases passed.
  Implementation checkpoint `c9b8b49`. Later tests add real matcher, alternate
  sign-in POST and lock-timeout/cleanup guarantees.
- Final lint, typecheck, production build and database-free test run passed:
  71 suites / 870 tests, with 271 PostgreSQL cases explicitly skipped there.
  Separate isolated PostgreSQL run passed all 15 suites / 271 cases, including
  eight counter cases. No quantitative coverage tooling or new E2E framework was
  added; Task 32 retains its focused remaining-gap scope.
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities. The existing
  diagnostics/instrumentation `node:crypto` Edge-bundle warning remains; the proxy
  runs on Node.js. No new warning category was introduced.
- Both `afcs_task07_verify` and local `afcs_dev` applied/reapplied the migration:
  18 ledger entries, all committed hashes matched, prior ledger unchanged.
  Schema generation reported no drift. Integration writes used only the isolated
  verification database; the development database received only the additive schema.
- Six actual production-server HTTP checks use isolated synthetic anonymous
  counters: an admitted extension-path POST reaches 404 and increments once;
  the next POST cannot evade 429 with forged headers; the unchanged payload is
  admitted after database-clock expiry; sign-in GET and Clerk proxy POST stop
  before Clerk; ordinary GET stays available; unavailable PostgreSQL returns safe
  503. These are HTTP admission checks, not successful business transactions or
  a provider-backed session. Ignored scripts/logs/results are under
  `artifacts/task31-abuse-controls/`.
- The first smoke setup used mismatched 127.0.0.1/localhost hostnames, causing an
  existing Clerk self-rewrite loop. Using canonical localhost for listener,
  origin and client produced one admission per request. No app workaround was
  introduced; final smoke uses a clean rebuilt production artifact.
- A pre-existing ignored `baseline-homepage.tsx` browser fixture had an invalid
  relative import and was included by the broad TypeScript glob. Preserved it as
  `baseline-homepage.tsx.txt`; no tracked compiler setting was weakened.

## Limitations and next task

Remote CI/review, live Clerk sessions/phone codes, Pashto terminology, authenticated
browser recovery, Netlify/Neon compatibility, deployed identity/edge trust,
spending/backup/restore controls and real-pilot acceptance remain separate
evidence. No deployment, paid setup, provider configuration or pilot gate closure
is claimed. This feature changes no screen styling or domain calculation.

**Next task: 32 — focused unit and integration test coverage.** Tasks 16/23–24/29
remain deferred in the approved pilot order.

## Research references

- [Drizzle PostgreSQL upsert](https://orm.drizzle.team/docs/insert#on-conflict-do-update)
  and [upsert guide](https://orm.drizzle.team/docs/guides/upsert).
- [Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
  and [Server Action limits](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions).
- [Netlify Next.js support](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/),
  [rate limiting](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/)
  and [Edge context](https://docs.netlify.com/build/edge-functions/api/).
- [rate-limiter-flexible Drizzle store](https://github.com/animir/node-rate-limiter-flexible/wiki/Drizzle).
