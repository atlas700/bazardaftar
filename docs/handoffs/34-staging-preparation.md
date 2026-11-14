# Task 34 — staging preparation

Date: 14 November 2026. **Repository preparation complete; Task 34 remains open.**
No hosted resources have been created. The founder confirmed that the Netlify
test site and Neon test project do not exist yet, and no provider credentials or
authenticated provider CLI session are available in this workspace.

## Completed preparation

- `netlify.toml` selects Node 24, `npm run build` and `.next`, with Netlify's
  automatically maintained OpenNext adapter. Builds do not apply migrations.
- `src/app/health/route.ts` provides a dynamic Node-runtime health check using
  read-only `select 1`, a five-second query timeout and uncached generic 200/503
  responses. It exposes no connection details or business records.
- `src/auth/middleware.ts` lets only exact `GET`/`HEAD /health` skip Clerk and
  locale middleware. Writes, nested health paths and other routes retain their
  existing authentication processing and request-admission behavior.
- `src/db/index.ts` bounds pool connection acquisition at five seconds, retaining
  lazy creation, development reuse and redacted background-error handling.
- `docs/staging-setup.md` covers isolated synthetic records, environment scopes,
  direct migration/backup versus pooled runtime URLs, applying migrations twice,
  hosted auth/workflow checks, backup/restore, monitoring, spend controls and rollback.
  The backup schedule and monitoring steps are operator instructions, not configured
  services. Founder ownership and ADR 0018's recovery targets remain unchanged.
- `.gitignore` excludes Netlify local state and database dump archives. Deployment
  documentation, its index and the build plan link this preparation and distinguish
  it from live acceptance. Tasks 32/33 remain open PRs with passing checks.

No dependency, schema, migration, domain workflow or new environment variable is
introduced. Business-page guards are unchanged. The health check proves database
reachability only.

## Test-first and review evidence

The resumed worktree already contained the endpoint, pool timeout and tests.
Baseline lint and 879 default tests passed (272 database cases skipped), but both
typecheck and production build failed with TS2769: `query_timeout` is absent from
the installed `pg` `QueryConfig` type. This is compile-time RED on the route
exercised by `src/app/health/route.test.ts`; checkpoint `bf187e7` preserves it.

The minimal fix keeps the supported per-query timeout in an inferred object before
passing it to `query`, without assertions or weakening TypeScript. Typecheck and
the same health/database targets then passed (six tests); GREEN is preserved in
`f2e620f`. Context7 documentation and the installed `pg` runtime confirm the option.

The initial built-app HTTP smoke timed out after 15 seconds on both a reachable
and a deliberately unreachable database configuration because probes still passed
through Clerk. Regression tests reproduced health reads entering Clerk/locale
processing (two failures, 19 passes), preserved in `bacf8d4`. A narrow early return
fixed both tests; all 28 focused health, pool and middleware tests passed. GREEN
is preserved in `60d6466`.

Pre-validation review used the Ponytail review skill against the full Task 34 diff,
the shared pool's callers, proxy/auth/locale path, health tests, Netlify config and
recovery commands. Assumed load is the small synthetic pilot rehearsal. Findings:

- **Fixed:** timeout type error prevented a deployable build.
- **Fixed:** local Netlify state and the documented dump filename were not ignored;
  ignore rules now protect those artifacts from ordinary Git staging.
- **Fixed:** read-only health probes depended on Clerk/locale processing; the exact
  path/method bypass has tests proving other paths and writes retain the boundary.
- **Fixed:** the build plan still named Task 31 and pending Task 33 browser CI;
  current order and inspected GitHub evidence now agree.
- No unresolved must-fix finding in repository preparation. Netlify adapter/TCP
  behavior, hosted cookies and real recovery remain deployment acceptance checks.

## Verification

- Final `npm run lint`, `npm run typecheck`, `npm run test` and `npm run build`
  passed: 73 test files / 884 tests passed; 15 files / 272 opt-in database tests
  skipped. No new dependency or migration required a database integration rerun.
- `npm audit --omit=dev --audit-level=high` found zero vulnerabilities.
- Built-app HTTP assertions passed on loopback: GET/HEAD returned uncached 200
  with the existing local database and generic uncached 503 with a deliberately
  unreachable port. No redirect, cookie or auth session was required. GETs took
  323 ms and 173 ms respectively; HEAD responses had empty bodies.
- `git diff --check` passed; Git ignores `.netlify/state.json` and the documented
  `staging-rehearsal.dump`. No credential or dump was staged.
- The pre-existing `node:crypto` Edge instrumentation build warning remains;
  the production build succeeds. Hosted adapter/runtime acceptance stays open.

Temporary smoke servers were stopped. No hosted sign-in, migration, backup,
restore, or alert delivery is claimed. Tests and recovery commands establish
preparation only; Task 34 is not complete.

## Remaining acceptance and exact next task

**Continue Task 34:** connect founder-owned Netlify/Neon accounts and create the
separate free test resources, using secure credential entry. Select and privately
record the test region and stable origin, configure test Clerk and runtime secrets,
apply reviewed migrations twice, deploy and verify health/auth/permissions/proxy
admission plus the synthetic purchase-to-payment workflow.

Then configure and measure backup retention, recovery point/time and an isolated
restore; test downtime/recovery, backup-failure and spending emails and enforceable
quota controls. Free testing alone does not establish the real pilot's 30-day
retention, one-hour data-loss or four-hour recovery guarantees. Paid production
provider/destination/cost decisions remain open under ADR 0018; no paid resources
are authorized by this preparation. Keep real business use closed.

Task 35 onboarding, support and measurement follows verified staging. Pashto
terminology, real pilot sign-in and outgoing-stock reconciliation remain separate
pilot gates. Tasks 16, 23–24 and 29 stay deferred.
