# Task 32 — Focused pilot test coverage

Date: 9 November 2026. Acceptance and local verification complete; ready for review.

## Acceptance and invariant register

The existing domain suites already exercise the pilot's critical invariants.
This task reuses them rather than adding duplicate financial tests or a coverage
percentage gate. Names below identify concrete failing cases, including opt-in
PostgreSQL cases; provider identity is mocked unless stated otherwise.

| Invariant | Named tests / source |
| --- | --- |
| Tenant and resource ownership | [Receipts](../../src/db/receipts.integration.test.ts): foreign purchase/line/unit references; [payments](../../src/db/supplier-payments.integration.test.ts): tenants, suppliers and debt currencies; [statements](../../src/db/supplier-statements.integration.test.ts): foreign supplier/cursor denial |
| Current membership and role | [Onboarding](../../src/db/onboarding.integration.test.ts), [staff](../../src/db/staff.integration.test.ts), [receipts](../../src/db/receipts.integration.test.ts), [adjustments](../../src/db/inventory-adjustments.integration.test.ts), [payments](../../src/db/supplier-payments.integration.test.ts): role denial, provider identity changes, authority rechecked after organization lock waits |
| Exact totals and conversion | [Domain helpers](../../src/domain), [receipts](../../src/db/receipts.integration.test.ts): three partial receipts reconcile to 100 AFN / 3 kg; [payments](../../src/db/supplier-payments.integration.test.ts): half-cent and six-decimal conversion, aggregate amounts above one entry's bound |
| Purchase transitions | [Purchases](../../src/db/purchases.integration.test.ts): revision conflicts, ordering/cancellation, current authority, and immutable ordered snapshots |
| Receipt atomicity and retries | [Receipts](../../src/db/receipts.integration.test.ts): matching replay, changed-payload conflict, simultaneous duplicates, competing receipt quantities, and rollback at receipt/item/movement/payable/status stages |
| Stock never negative | [Adjustments](../../src/db/inventory-adjustments.integration.test.ts): one-gram overdraft, exact zero, concurrent deductions, signed provenance, idempotent replay and foreign references |
| Supplier settlement | [Payments](../../src/db/supplier-payments.integration.test.ts): oldest-first ordering including sub-millisecond ties, overpayment rejection, competing payments, lifetime reduction caps, failed allocation/reduction rollback |
| Cross-service reconciliation | [Dashboard](../../src/db/dashboard.integration.test.ts): receipt debt minus payments/reductions agrees with supplier statements; signed stock remains independently ledger-derived; [statements](../../src/db/supplier-statements.integration.test.ts): partial/full settlement and distinct AFN/PKR balances |
| Durable sensitive events | [Audit](../../src/db/audit.integration.test.ts): append-only constraints, actor attribution, provider intent/completion and rollback when audit insertion fails |
| Admission safety | [Limits](../../src/db/request-limits.integration.test.ts): exact concurrent budgets, separate scopes, database time, contention timeout, bounded cleanup; new regression caps retry hints at the 60-second window |

## Changes and test-first evidence

- Added `npm run test:integration` and `vitest.integration.config.mts`. Missing,
  malformed, non-PostgreSQL and wrong-database URLs fail before suite loading.
  Default database-free tests retain their opt-in skip behavior.
- Automatically discover all `src/db/*.integration.test.ts` suites. Run files
  sequentially to avoid competing exclusive audit-teardown locks. CI runs seeds
  32 and 33 after applying migrations twice.
- Five initial runner-guard tests failed before the configuration existed, then
  passed. Checkpoint `5d0ee2c` records the reproducer.
- The first shuffled run exposed a retry hint of 61 seconds during concurrent
  admissions. PostgreSQL statement timestamps can precede the winning insert's
  timestamp. A deterministic future-reset fixture reproduced 61 instead of 60;
  checkpoint `2912be9` records that failure. The shared SQL now caps the hint to
  the fixed window without changing admission accounting, expiry or allowances.
- Corrected stale README/deployment smoke instructions: supplier payments and
  dashboard metrics are implemented; sales and outgoing-stock recording remain
  outside the pilot.

## Pre-validation review

Reviewed the whole task diff, isolated database guard, suite discovery, CI
environment, request-limit SQL, middleware callers and their response tests.
The retry hint changes neither allowance decisions nor financial writes.
No dependencies, schema or migration changes. A focused read-only review found
that a remote database with the disposable name could pass the initial guard.
The fix restricts it to loopback hosts without query/fragment overrides; two
additional failing cases cover a remote host and a query-string host override.
Parent rechecked the guard and all connected callers. No unresolved findings.

## Verification

- `npm run lint`, `npm run typecheck`, `npm run test` and `npm run build` passed.
  Default tests: 72 passing suites / 877 tests; 272 opt-in PostgreSQL cases skipped.
- All 15 PostgreSQL integration suites passed twice: 272 cases for seed 32 and
  272 for seed 33. An independent before/after organization-ID snapshot matched
  after each run; all 14 pre-existing tenants were preserved. Request-limit tests
  remove their tracked synthetic keys separately. Verification driver is ignored
  at `artifacts/task32-invariants/verify.mjs`.
- Reapplied the committed migration history on the isolated database: 18 ledger
  entries, no new migration. No development database writes performed.
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities.
- `git diff --check` passed. The existing `node:crypto` Edge instrumentation
  build warning remains; no new warning category was introduced.
- Remote CI is pending delivery; live provider and deployment checks are separate.

## Limits and next task

Existing isolated database rows are preserved; fixture cleanup deletes only each
suite's tracked synthetic tenants. This is local/mocked-provider evidence, not
live Clerk OTP, terminology review, hosted deployment or backup recovery evidence.

**Next task: 33 — one deterministic browser purchase-to-payment workflow.**
