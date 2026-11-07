# Task 26 — Supplier balances and transaction statements

Date: 7 November 2026. Acceptance and local verification complete; ready for PR review.
Source: [Task 26](../agent-sized-build-plan.md#26--implement-balances-and-transaction-statements),
[ADR 0009](../adr/0009-specific-obligation-payment-allocation.md) and
[ADR 0019](../adr/0019-pilot-numeric-settlement-policy.md).

The user journey is staff opening a supplier account, checking separate AFN/PKR
balances, tracing receipts/payments/reductions, and browsing older postings without
losing reconciliation. This task adds reads and navigation, with no financial write,
schema, migration, dependency, environment-variable or product-policy changes.

## Completed acceptance checks

- `getSupplierAccount()` derives both currency totals from recognized receipt debt
  minus payment allocations minus separate owner reductions. PostgreSQL `numeric`
  aggregation returns exact fixed two-decimal strings; aggregate values may exceed
  the bound of one obligation. Currency balances never mix.
- One payment contributes its allocation sum once, retaining original AFN/PKR cash,
  recorded rate, payment date, reference and note. Its receipt allocations are
  available separately. A 75 AFN payment against 60 + 40 AFN leaves 25 AFN, even
  though it has two allocations. A 0.79 reduction is visibly noncash and retains
  its receipt/payment links, reason, approver and posting timestamp.
- All receipt payables remain in history, including settled and zero-value rows.
  Inactive suppliers remain readable. Free-text payment terms are shown without
  inferring due dates or overdue classifications.
- The reader requires `supplier_balances.read`, verifies provider organization,
  membership and user, and rechecks the membership-bound local grant on the read
  connection. Every source and cursor anchor is scoped to the verified organization,
  supplier and chosen currency. Client tenant/role fields provide no authority.
  Warehouse/sales roles cannot read these accounts.
- Balances, statement events and batched allocation traces use one read-only
  repeatable-read snapshot. Running balances are computed across the full currency
  account before the 20-row page boundary. Posting order is timestamp, kind
  (receipt, payment, reduction), then UUID; display is newest first. `kind:UUID`
  cursors resolve a scoped database timestamp without losing microseconds. Changing
  currency resets pagination. Payment calendar dates are separate from posting order.
- `/suppliers/[id]/statement` shows totals first, then signed event rows with source
  links and native allocation disclosures. Authorized supplier details and payments
  link to it. Selected currency has a visible state and an accessible current marker.
  Existing shared controls/tokens, translation wrappers, logical layout and isolated
  numeric/user text follow ADR 0020.
- Direct `paymentId` lookup in `/payments` reaches older payments outside its newest
  page. The UUID is validated and tenant/supplier/currency scoped; combining it with
  `after` is rejected. Missing/foreign scope uses the existing unavailable response.
  Latest-payments navigation exits the focused view. No payment mutation changed.

## Changed files and reuse

- New server-only `src/db/supplier-statements.ts`, boundary tests and isolated
  PostgreSQL tests.
- New statement page, loading/error/unavailable boundaries and screen tests;
  supplier/payment navigation and protected-page tests.
- Existing supplier reader exposes balance-read eligibility for navigation; existing
  payment reader accepts an optional scoped payment UUID.
- PostgreSQL CI includes the statement suite. README, module map, database/API/
  security/testing guidance, documentation index and build plan reflect the feature.

No balance table, cache or replacement ledger is introduced. These account totals
can support Task 28's supplier metrics and later approved reconciliation reports;
they are not a general accounting journal or stock valuation query.

## Pre-validation review

Applied Ponytail review to the complete task diff, connected receipt/payable/
allocation/reduction schemas, payment and supplier callers, permission catalogue,
route boundaries, tests and CI list. Assumed the approved small purchasing pilot.
Checked exact aggregation and join multiplication, page-boundary running balances,
microsecond/type ties, scoped cursors and payment links, current provider/local
authority, parameter binding, safe errors, escaped user text and UI recovery.

Resolved the review's missing visible selected-currency treatment with the existing
secondary button variant, then rechecked the rendered states. No unresolved must-fix
findings remain. A plan probe of the actual event/window query against an empty
synthetic account ran in 2.695 ms; this is query-shape evidence, not a large-history
benchmark. No additional index is justified by the current pilot evidence.

## Test-first and final verification

| Guarantee | RED checkpoint | GREEN evidence |
| --- | --- | --- |
| Exact authorized supplier accounts | `92ee6b5`: boundary suite failed because the account reader did not exist | `d8a9595`: 16 boundary and 14 isolated PostgreSQL cases passed |
| Statement UI and historical navigation | `5f237d2`: missing statement route and two navigation assertions failed | `f3c96b0`: 20 supplier/payment/statement UI cases passed |

Final checks after review:

- `npm run build`, `npm run typecheck`, `npm run lint`: pass. Build includes the
  dynamic supplier statement route.
- `npm run test`: 58 files and 784 database-free tests pass. Its 225 PostgreSQL
  cases are explicitly skipped without their dedicated URL.
- All 12 isolated PostgreSQL suites: 225 tests pass, including 15 statement cases.
  The local ignored credential-safe wrapper uses only `afcs_task07_verify`; tests
  mock Clerk, create synthetic tenants and clean only their own records.
- The final statement boundary suite has 17 cases; additional payment-query,
  permission, PKR-conversion and same-tenant supplier-scope assertions pass.
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities.
- Targeted security/diff inspection and `git diff --check`: pass. No unsafe SQL
  construction, floating-point money, raw exception logging or client authority.
- Local Markdown link/anchor checks pass; RED/GREEN evidence is retained here for
  squash merges. Coverage percentages are not measured; no coverage tooling added.

Ignored `artifacts/task26-statements/` contains actual-component fixtures inside
the actual workspace shell: 60 layout cases across populated, inactive, viewer,
empty, older-page, PKR, long-content, loading, error and unavailable states at
1440/390/320px in LTR/RTL. All pass overflow, text-fit and 44px-control checks.
Ten native keyboard disclosure/navigation checks pass with reduced motion enabled;
no browser page errors occurred. Desktop and mobile screenshots were inspected.
The local design evidence checker passes, and Taste source lint has no findings.

Taste rendered inspection has no unallowed failures. The `edge-text` allowance is
for the existing horizontally scrollable mobile shell navigation clipping its edge
label at 320px; main content passes separate strict reflow checks. Its one warning
is the inherited 30px mobile PageHeader, retained under ADR 0020's shared 18–32px
hierarchy. The existing palette/system font/shell are retained; no design redraw.

## Limits and next task

Browser fixtures mock identity/data; PostgreSQL tests mock Clerk. They establish
neither live sign-in, provider-backed browser navigation/mutations, translated
Pashto terminology nor deployment/backup/recovery acceptance. Remote CI/review
status is separate from these local results. Paginated requests take fresh
snapshots; the account is not frozen across multiple requests. Large-history
performance, general reports/exports, customer statements, payment reversals,
advances, sales and a full provider E2E journey remain outside this task.

Next: **Task 27 — add append-only audit logging** for the approved sensitive pilot
events. Pilot sign-in, terminology, outgoing-stock reconciliation and operational
release gates remain open.
