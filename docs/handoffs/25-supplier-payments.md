# Task 25 — Supplier payments and rounding reductions

Date: 5 November 2026. Acceptance and local verification complete; ready for PR review.
Scope follows [ADRs 0009](../adr/0009-specific-obligation-payment-allocation.md)
and [0019](../adr/0019-pilot-numeric-settlement-policy.md). Task 26 statements,
Task 27 general audit events, and all deferred sales/customer features are excluded.
Source plan: [Task 25](../agent-sized-build-plan.md#25--record-and-allocate-supplier-payments).
The user journeys are staff recording cash against supplier debt, an owner
approving a later residual reduction, and authorized staff tracing cash to receipts.

## Completed acceptance checks

- Payment entry records supplier, one debt currency, calendar date, whole AFN/PKR
  cash, agreed rate, reference/note, and verified actor identity. Cash is converted
  exactly, rounded half-up once, and distributed oldest-first across unpaid Task 20
  receipt payables. Ties use payable creation time, then UUID ascending, retaining
  PostgreSQL microseconds. Zero-valued payables receive no allocation.
- Payments and allocations commit together. A payment can fully settle multiple
  receipts and partially settle the next. Zero balances, overpayments, malformed
  cash/rates and conversion overflow are rejected before posting. Original debt,
  actual cash and historical rates are never overwritten.
- `supplier_payments.record` retains owner/admin/accountant access. The approved
  `supplier_payments.adjust_rounding` permission is owner only. Both commands lock
  the organization and recheck current provider organization/membership/user and
  local permission on the transaction connection, including authorized replays.
- Owner reductions are a separate action against an existing payment allocation,
  with explicit approval, reason, payable/payment references, currency, actor
  user/membership and UTC creation time. They can be approved after cash entry.
  Balance and lifetime 0.99-per-payable cap checks serialize with payment writers;
  later payments and retries cannot reset or pool the cap. The dedicated reduction
  rows are durable approval evidence in this task; general audit events remain later.
- Matching normalized UUID requests replay the original result once; changed
  contents conflict. Receipt-backed tenant/supplier/currency foreign keys constrain
  allocations and reductions. Unexpected action errors preserve framework control
  flow and expose only a correlation UUID. Duplicate scalar form fields are rejected.
- `/payments` replaces the placeholder with supplier/currency selection, exact
  outstanding debt for entry, 20-row payment-history pages and receipt allocation
  links. Cash appears once per payment; reductions remain visibly separate.
  `/payments/new` records cash; `/payments/rounding` collects explicit owner approval.
  Separate entry routes unmount after success, giving the next entry a fresh UUID.
- Forms use shared controls/tokens, translated copy wrappers, logical layout,
  visible labels/help/errors, confirmation, pending controls, feedback focus and
  retained values/retry UUIDs within the verified business. Inactive suppliers may
  settle existing obligations; deactivation does not remove debt.

Balance derivation is recognized receipt debt minus allocation amounts minus
separate approved reductions, independently for AFN and PKR. For example, 60 + 40
AFN debt and 75 AFN cash produce allocations of 60 + 15 and leave 25 AFN. Paying
62 against 62.79 leaves 0.79 until its separate reduction is explicitly approved.

## Changed files and migration impact

- `src/db/schema/index.ts`, `supplier-payments.ts` and colocated boundary/PostgreSQL
  tests; fixed permission catalogue and role tests.
- Payment route, cash/reduction pages, shared filter/form, actions, loading/error/
  unavailable states, navigation and connected guard/screen/action tests.
- Existing PostgreSQL CI command includes the new integration suite.
- README, build plan, documentation index, database/API/security/architecture/testing
  guidance and this handoff record the implementation and next task.
- Generated `0014_wise_wrecker.sql` adds three settlement tables plus context keys
  and query indexes. Its reviewed ordering creates the payable context unique key
  before the referencing foreign key. `0015_exact_cash_settlement_check.sql` uses
  quotient/remainder arithmetic for exact AFN half-up verification; ordinary
  PostgreSQL division can round an intermediate value at a half-cent boundary.
  Both migrations and snapshots are retained; applied history is not rewritten.
- No dependency or environment-variable changes. Apply all reviewed migrations
  before using payment routes. Application rollback must retain the payment and
  reduction records; do not delete posted settlements or overwrite debt balances.

## Pre-validation review

Used Ponytail review across the full task diff, connected receipt/numeric/tenant/
role services, server actions, screens, migration SQL and tests. Assumed the
approved small pilot with serialized organization writes. Reviewed authorization,
tenant isolation, exact arithmetic, snapshots, FK contexts, cap/retry/concurrency
checks, rollback, safe errors and UI confirmation/recovery.

Resolved findings: generated FK ordering, PostgreSQL intermediate division at a
half-cent boundary, initially blank server-rendered Radix value labels (now
controlled and visible before hydration), an ISO year-zero value unsupported by
PostgreSQL, omitted optional action fields, and shared token/JSX text corrections.
The earlier navigation test expecting a Payments “Soon” marker was updated for the
implemented route, retaining the Sales “Outside pilot” assertion. No unresolved
must-fix findings remain after rechecking the affected paths.

## Test-first evidence

Checkpoints remain reachable on this feature branch:

| Guarantee | RED checkpoint | GREEN checkpoint and evidence |
| --- | --- | --- |
| Validated commands and owner-only reduction authority | `df3bfa2`: missing service and owner permission | `81bd064`: 62 focused command/permission cases passed |
| Exact database conversion at extreme half-cent boundaries | `eabc0d7`: valid 1.00 AFN rejected by the approximate database check | `caebfab`: exact check, 24 PostgreSQL cases passed |
| Cash/approval screens and action contract | `764e666`: missing routes/actions | `4b74b4b`: screens/actions/guards passed; 28 PostgreSQL cases passed |
| Selected filter values visible before hydration | `b3003a6`: selected values absent in server markup | `fa77f6f`: selected labels render; controlled values follow selection |
| Calendar bounds and omitted optional fields | `44bb6ef`: year zero reached posting and optional fields became null | `91d8d4c`: 47 focused cases passed |

Human-readable guarantees are specified by `src/db/supplier-payments.test.ts`,
`supplier-payments.integration.test.ts`, payment action/UI tests and role/navigation
tests. Retain this RED/GREEN summary if the PR is squash-merged.

## Final verification

- `npm run build`, `npm run lint`, `npm run typecheck`: pass. Build includes
  `/payments`, `/payments/new` and `/payments/rounding`.
- `npm run test`: 56 files and 756 database-free tests pass; the 210 PostgreSQL
  cases are explicitly skipped without their dedicated URL.
- All 11 isolated PostgreSQL suites: 210 tests pass, including 28 settlement cases.
  Local execution used the ignored credential-safe `run-db.cjs` wrapper to set
  `AFCS_TEST_DATABASE_URL`; CI uses the explicit suite list in its database job.
- Both `afcs_task07_verify` and `afcs_dev` apply/reapply reviewed migrations with
  the official node-postgres migrator: 16 ledger entries, 18 application tables,
  and matching hashes for new migrations. Earlier migration files are unchanged.
  The first CLI attempt stopped at its spinner without applying the failed FK
  migration; explicit driver verification found and resolved the ordering issue.
- `npm.cmd run db:generate -- --name=task25_drift_check`: no schema changes.
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities.
- Targeted security/diff review and `git diff --check`: pass. The only production
  diagnostic is a safe event/stage/correlation object. No client authority,
  floating-point money, unsafe SQL concatenation or raw exception logging is added.
- Local Markdown path/anchor verification: 218 checks across nine changed documents
  pass. No application dependencies or extra coverage/E2E framework were installed.

Local fixture evidence lives under ignored `artifacts/task25-payments/`: 54 layout
cases at 1440/390/320px in LTR/RTL and 20 actual-component interaction checks passed.
Four additional hydrated filter checks verify selected labels and submitted
supplier/currency values stay aligned.
Taste source lint reported no failures/warnings. The app inspector reported no
failures and one defended warning: the shared ADR 0020 mobile PageHeader is 30px.
It remains within the shared 18–32px hierarchy and wraps without overflow.
Desktop/mobile screenshots were inspected. Design uses the existing ADR 0020
workspace direction and system font; no new palette, font, shell, or sample product
data was introduced. Synthetic fixture names/cash never enter application storage.

## Limits and next task

Local PostgreSQL tests mock Clerk and browser fixtures mock actions; neither proves
live provider authentication, database-backed browser mutations, translated Pashto
terminology or deployment acceptance. Coverage percentages and the full provider
E2E journey are not measured; existing coverage tooling remains unchanged.
Remote CI/review status is separate from local verification.

Supplier options and open payables load in full for the small pilot; paginate when
trading histories require it. Very large allocation inserts need batching inside
the same transaction. Correction/reversal of posted payments, advances/unapplied
credit, online payment rails, customer payments and sales remain deferred.
General account statements/reconciliation are not supplied by the payment register.

Next: **Task 26 — implement supplier balances and transaction statements**, reusing
receipt payables, payment allocations and separate owner reductions while counting
each payment once. Pilot sign-in, terminology, outgoing-stock reconciliation and
operational release gates remain open.
