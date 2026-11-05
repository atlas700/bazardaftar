# Testing

## Pre-validation code review

After implementing a feature or code/configuration change, and before the final
quality-command pass:

1. Use `ponytail:ponytail-review` to review the complete task diff and connected
   callers and tests against the task's acceptance criteria and repository rules.
2. Trace affected security boundaries: input validation, authentication,
   authorization and tenant isolation, injection risks, and secret or sensitive
   data exposure. Check transaction safety, error handling, regressions, and
   missing tests where relevant.
3. Fix all must-fix findings and recheck the fixes before running the final
   quality commands. Record the review scope, findings and their disposition, and
   any remaining limitations in the handoff; explicitly state when no findings
   were found.
4. Run the required quality commands below and task-specific acceptance checks.
   If a validation fix changes code, review the changed paths again before
   rerunning the affected checks.

Keep tests and focused checks running during development, including test-first
work. This review complements the dependency audit and GitHub PR review. It is
an agent workflow requirement; CI continues to run the existing automated checks.

## Quality commands

- **Node.js:** 24.x (the current local baseline is 24.20.0).
- Install locked dependencies with `npm ci`.
- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- CI runs those same commands on every push and pull request.
- A separate CI job starts disposable PostgreSQL 16, applies committed migrations
  twice, and runs the onboarding/authorization, staff, catalogue, product, supplier,
  warehouse, purchase, receipt, inventory, and stock-adjustment integration suites
  with `AFCS_TEST_DATABASE_URL`. It uses fixed, job-local credentials and no live services.
- CI also runs `npm audit --omit=dev --audit-level=high` after installation. Run it
  locally for dependency or CI changes and before deployment.

## Strategy

- Vitest is the unit-test runner. `npm run test` uses `vitest run` for a
  non-interactive one-shot run and fails if no test files are discovered.
- Configuration and authentication tests cover missing/malformed keys, origin
  validation, sanitized session lookup, protected-page guard denial/acceptance,
  and the sign-in page. Auth unit tests mock Clerk; they do not establish
  real credential delivery, session revocation, or production-cookie behavior.
- `vitest.config.mts` resolves the same `@/` source alias used by application code.
- Database unit tests cover URL validation, lazy pool creation, development reload
  reuse, and sanitized background errors without connecting to PostgreSQL. Task 07
  separately verifies its baseline migration on a fresh local database and then
  development. The separate CI database job now verifies committed migrations
  against a fresh disposable service; the `quality` job stays database-free.
- Existing suites cover tenancy, authorization, exact totals, purchase transitions,
  receipts/payables, inventory reads, stock adjustments, supplier payments and
  owner-approved rounding reductions. Task 32 closes remaining critical pilot gaps.
- Task 08 tests mock Clerk and the PostgreSQL transport while using Drizzle's real
  query generation. They cover exact organization/user filtering, absent/deleted
  or mismatched membership, stale claims, sanitized failures, the parameterized
  local mapping read, and rechecking after removal or organization change. Local
  acceptance separately applies/reapplies reviewed SQL and checks defaults and
  constraints in a rolled-back transaction on the isolated verification database.
- Task 09 unit tests cover validated creator-only bootstrap, remote recovery,
  current membership denial, safe correlation, preserved framework redirects, and
  onboarding routing. Eight opt-in PostgreSQL tests cover actual concurrent
  reservation/completion, pinned IDs, uniqueness, tenant-scoped reads, rollback,
  and non-overwrite behavior. Follow the
  [isolated command](database.md#onboarding-persistence-and-verification). Local
  default runs and CI's `quality` job skip these tests without
  `AFCS_TEST_DATABASE_URL`; the CI `database` job explicitly supplies it.
- Task 09's manual development browser smoke covers real sign-in/onboarding,
  validation and retained values, activation after persistence, idempotent resume,
  mobile RTL layout, membership-removal denial, and sign-out. It adds no E2E
  framework or CI browser suite; those retain Task 33's scope.
- Task 10 adds permission-default tests, current tenant/role guard tests with
  parameterized real Drizzle queries, and per-page permission checks. The isolated
  PostgreSQL suite had fifteen tests at Task 10 delivery: it also verifies explicit
  legacy setup resume, one-time owner bootstrap, concurrent membership claims,
  rollback, non-restoration after role
  deletion/downgrade/rejoin, constraints, and actual grant query isolation. The
  guard preserves sign-in/framework exceptions and sanitizes service failures.
- Browser end-to-end coverage is deferred to Task 33; it must use isolated seeded
  data for purchasing, accepted receipt/payable creation, supplier payment, and
  stock/supplier balance reconciliation rather than a shared development database.

## Supplier payment verification

Task 25 adds payment-boundary, action, role-matrix and screen cases plus
`src/db/supplier-payments.integration.test.ts` in the existing isolated PostgreSQL
job. Its database cases cover receipt-backed oldest-first allocation with timestamp
ties, both exchange directions and exact half-cent boundaries, separate currencies,
large aggregate debt, full/partial settlement, overpayment rejection, concurrent
requests, normalized replay/conflicts, provider/local-role rechecks, every role,
tenant and settlement-context constraints, rollback, scoped pagination, and separate
owner reductions with lifetime-cap races. Default runs skip database suites without
`AFCS_TEST_DATABASE_URL`; the database suite refuses every database name except
`afcs_task07_verify` and cleans only its synthetic tenants.

Local actual-component browser fixtures check LTR/RTL reflow, labelled fields,
confirmation, retained values, stable retry IDs, feedback focus and pending controls.
Their evidence and limitations are recorded in the
[handoff](handoffs/25-supplier-payments.md). They do not establish live Clerk,
translated terminology, provider-backed browser mutations or deployment acceptance.

## Inventory adjustment verification

Task 22 adds command/action/screen tests and an isolated PostgreSQL suite for
owner-only correction entry, required reasons/approval, signed whole-gram input,
exact-zero deductions and below-zero rejection, concurrency, authorized normalized retries,
changed-payload conflicts, tenant/active references, provider identity changes,
revocation while waiting, snapshot history and source constraints. Existing
inventory tests also cover mixed receipt/adjustment history. The separate CI
database command includes `src/db/inventory-adjustments.integration.test.ts`.
Default tests skip database suites without `AFCS_TEST_DATABASE_URL`; the suite
guards `afcs_task07_verify` before writing and cleans only its synthetic tenants.
Rendered/hydrated fixture evidence and its limits live in the
[Task 22 handoff](handoffs/22-inventory-adjustments.md).

## Warehouse verification

Task 17's service/action/UI tests cover existing business-settings permissions,
validated scalar fields, bound SQL, tenant-derived authority, fresh actor/grant
checks after locking, singleton conflicts, safe action failures, retained values,
linked error summaries, pending controls, read-only/empty/inactive screens, and
reactivation of the same record. Settings navigation is checked across all roles.
`src/db/warehouses.integration.test.ts` uses the existing isolated database guard
and cleanup to verify actual concurrent singleton creation, all seven roles,
tenant isolation, field/FK constraints, failed-edit preservation, active-only selection, and queued
revocation. It is included in the existing disposable PostgreSQL CI job.
Synthetic rendered/hydrated checks are recorded in the [handoff](handoffs/17-warehouses.md);
they do not establish live Clerk, provider-backed mutations, or deployed acceptance.

## Purchase draft verification

Task 18 adds service/action/UI cases for bounded validated commands, permissions,
safe read/action errors, explicit aligned form fields, success refresh/redirect,
server-owned authority and totals, read-only views, snapshots, exact decimal
display, labelled fields, linked errors, pending state, and available navigation.
The isolated `src/db/purchases.integration.test.ts` suite adds 21 cases for real
transaction rollback, same-tenant foreign keys, active reference rechecks, all
seven roles, cross-tenant denial, historical snapshots, half-up line sums,
near-half-cent precision, concurrent retries/conflicts, and revocation while
waiting for the shared organization lock. The seven database suites contain
96 tests; default database-free runs skip these explicitly.

Ignored synthetic browser fixtures exercise actual purchase components and
hydrated form behavior: separate quantity/price measures and bag weights, stable
line removal, retained selectors/values after validation, pending controls,
keyboard/error focus, same-business retry identity, and business-switch reset.
A native capture listener prevents React's action reset from invoking Radix's
native reset listeners and erasing controlled selections. This local browser
regression is recorded in the [handoff](handoffs/18-purchase-drafts.md); it does
not establish live Clerk, translated terminology, deployed routes, or a real
provider-backed application session. Task 33 retains full E2E scope.

## Purchase lifecycle verification

Task 19 extends the existing purchase suites with draft editing, ordering,
owner-only cancellation and terminal-state guards; stale/concurrent writes and
latest-request replays; immutable creation retry identity; preserved name/kind/
weight snapshots; all-role and cross-tenant denial; transactional replacement
rollback; active-reference checks; metadata constraints; and queued authority
revocation. The purchase PostgreSQL suite contained 41 cases at Task 19 delivery.
Detail reads use a consistent transaction snapshot. Server Action/UI checks cover explicit aligned
saved-line fields, refreshed routes, current status, inactive references and
read-only access. No new test framework or dependency is introduced.

The [Task 19 handoff](handoffs/19-purchase-lifecycle.md) records synthetic actual-
component LTR/RTL and hydrated browser evidence, including Enter in a cancellation
reason originally submitting the order action. Separate forms and submit-time
confirmation fix that native-browser regression. This does not establish live
Clerk, provider-backed mutations, Pashto terminology acceptance, or deployment.

## Receipt acceptance verification

Task 20 adds input/action/form/route/history checks plus
`src/db/receipts.integration.test.ts` in the existing isolated PostgreSQL CI job.
It verifies partial/full and explicitly owner-approved short/excess acceptance,
all roles, active references, saved measure/price snapshots, exact per-line
cumulative reconciliation, zero/PKR payables, same/changed durable retries,
competing requests, revoked queued grants, tenant constraints and rollback at
receipt, line, movement, payable and status writes. The 100 AFN example recognizes
33.33/33.34/33.33 across three receipts; a multi-line example checks line-level
reconciliation before summing the payable. Actual-component synthetic browser
checks cover confirmation, Radix/reset retention, linked field errors, pending
controls, business-switch identity and desktop/mobile RTL layout. The
[handoff](handoffs/20-accepted-receipts.md) records results and limitations; these
checks do not establish live Clerk, translated terminology, or deployment.

## Inventory verification

Task 21 adds service and screen cases plus `src/db/inventory.integration.test.ts`
to the existing disposable PostgreSQL CI job. Coverage includes exact mixed-bag/
gram aggregates, totals beyond per-line bounds, inactive records and saved history
names, every role's stock/purchase access, tenant/product/cursor isolation, empty
and revoked access, and timestamp-tie pagination retaining PostgreSQL microseconds.
Balances remain complete when history pages change. Screen/navigation tests cover
exact large decimal display, escaped names, receipt links, product/paging scope,
sales permissions, loading/error/unavailable recovery, and available navigation.
Receipt-action tests require inventory invalidation after accepted delivery.
The [handoff](handoffs/21-inventory-balances.md) records local evidence separately
from remote CI and live provider/deployment acceptance.

## Staff management verification

Task 11 adds staff provider/action/UI tests plus unit tests using Drizzle's real
SQL generation. They cover owner-only changes, the last active owner, actor
rechecking, tenant and identity isolation, input validation, retry behavior,
safe errors, pending controls, and staff entry without a business grant.
Six additional opt-in PostgreSQL tests verify actual row-lock concurrency and
revocation against synthetic Clerk memberships. Run them with onboarding's
isolated command and `src/db/staff.integration.test.ts`; no live provider mutation
is needed. Static rendering verifies markup and feedback, not browser interaction
or email/OTP delivery.

## Domain primitive verification

Task 12's colocated `src/domain/*.test.ts` tests run with
`npm run test -- src/domain`, without a database or provider. They verify exact
decimal parsing/output, signed half-up ties, large values, precision and size
rejection, gram-precise custom/local measures, differing quantity/price measures,
rounded-line sums, cumulative receipt reconciliation, both cash exchange directions,
whole cash, the lifetime reduction cap, UUIDs, UTC timestamps, and explicit status
transitions. Expected monetary examples come from ADR 0019. These tests establish
pure calculations; later service tests must establish authorization, durable
snapshots, concurrent/idempotent posting, and reconciliation against stored rows.

## Catalogue verification

Task 13's service/action/static-render tests check input validation, tenant-bound
SQL, permission denial, actor changes while waiting for a lock, safe errors,
pending controls, retained values, and read-only management screens. Its opt-in
`src/db/catalog.integration.test.ts` suite checks every role, tenant isolation,
case-insensitive uniqueness, deactivation, custom measures, fractional weights,
10/11-maan bags, returned snapshots, actual database constraints, concurrent
seeding, and a queued actor's revoked grant. It uses the same isolated database
guard/cleanup as the other integration suites, and CI's database job includes it.
Static rendering does not establish live browser interaction or translation quality.

Task 14 adds product service/action/static-render tests and
`src/db/products.integration.test.ts` to the existing isolated CI job. Coverage
includes validation, authenticated tenant-derived authority, all roles, same-tenant
unit/category references (also enforced by database constraints), active reference
selection, case-insensitive product names and optional codes, concurrent duplicate
creation, failed-edit rollback, inactive record retention, and queued actor
revocation. UI checks cover list/detail/edit, read-only access, setup/empty states,
labels, retained values, inactive selections, pending state, and safe feedback.
These are separate from real browser, Clerk, and translation smoke evidence.

## Workspace UX verification

Task 15 adds supplier service/action/static-render tests and
`src/db/suppliers.integration.test.ts` to the isolated database job. The 13 supplier
database cases cover create/edit/deactivation, optional contact values and local
digits, every role, tenant denial, spoofed authority, concurrent duplicate names,
rollback, database constraints, and grant revocation during a queued write.
UI checks cover Radix Select, linked errors, pending controls, safe feedback,
read-only and inactive states, escaped notes, and the installed Next.js retry API.
Rendered fixture evidence remains separate from live Clerk/database interaction.

The UX audit fixes add session-aware home tests, seven-role navigation and
dashboard/settings checks, locale-aware Select tests, error retry wiring, and
confirmation cancellation/submission coverage. `src/db/workspace.test.ts` checks
the metadata read's verified organization/membership/user parameters and safe
denial/error behavior. The existing opt-in onboarding suite also checks business
identity/role switching and denial after revocation against isolated PostgreSQL;
the four database suites contained 50 tests at that delivery. Task 15 brings the
five isolated suites to 63 tests. Task 17 brings the six suites to 75 tests.

Local synthetic HTML/browser fixtures are kept under ignored `artifacts/`.
They exercise layout and native control behavior without contacting a provider or
application database. Their evidence does not establish real Clerk login,
translated terminology, deployed routes, or provider-backed mutations. No browser
test dependency or CI browser suite is added.

## Dependency gate

- The audit checks production dependencies and fails for high or critical
  advisories. Lower-severity findings remain visible for review.
- Update compatible affected packages and commit the lockfile; keep Next.js and
  `eslint-config-next` on the same version. Run all four quality commands after
  dependency changes.
- There are no advisory exceptions. If a fix is unavailable, obtain owner approval
  and record the advisory ID, affected path/reachability, mitigation, owner, and
  expiry/review date in `docs/security.md` before changing the gate. A failed audit
  remains a release blocker until fixed or an approved, narrowly scoped exception
  is implemented; never bypass it with `continue-on-error` or a broad severity change.

## Scope

- No browser DOM test environment, coverage tooling, or end-to-end framework is
  part of this baseline. PostgreSQL integration tests use only the dedicated local
  verification database or CI's disposable service, never a shared application DB.
- CI uses explicitly nonfunctional Clerk key placeholders only for compilation.
  They cannot sign in users and must not be reused for an application deployment.
  Unit tests use their own isolated placeholders and never contact Clerk.
- A normal local build requires development keys in `.env.local`. Follow the
  [authentication smoke check](deployment.md#authentication-setup-and-smoke-check)
  to verify real sign-in and sign-out; this remains separate from unit tests.
