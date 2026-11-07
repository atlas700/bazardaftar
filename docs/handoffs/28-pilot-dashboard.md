# Task 28 — Pilot dashboard

Date: 7 November 2026. Acceptance and local verification complete; ready for PR review.
Source: [Task 28](../agent-sized-build-plan.md#28--build-the-pilot-dashboard),
[ADR 0016](../adr/0016-local-business-authorization.md),
[ADR 0019](../adr/0019-pilot-numeric-settlement-policy.md),
[ADR 0020](../adr/0020-workspace-design-system.md).

The overview replaces the old coming-soon panel with purchases, accepted receipts,
recorded stock, outstanding supplier balances and recent business transactions.
It introduces no migration, dependency, environment variable, mutation, new
financial policy or audit reader. Existing navigation and shared UI are reused.

## Acceptance and metric sources

All data comes from server-only `getDashboard()` in `src/db/dashboard.ts`.
It derives the tenant through `requirePermission("organization.read")`, verifies
current provider identities and the membership-bound local grant again, then
reads one repeatable-read, read-only snapshot without a shared cache.

| Display | Source and policy |
| --- | --- |
| Purchase counts | Tenant-owned `purchase_orders`: all, draft, received, cancelled; awaiting delivery combines ordered and partially received. All-time counts, never a purchase-value debt estimate |
| Accepted receipts | Count `goods_receipts` once per accepted receipt, independent of receipt-line count or purchase status |
| Recorded stock | Sum signed `inventory_movements.quantity_kg` per product/warehouse; keep inactive references and exact zero. Show first five groups alphabetically with full inventory/history link |
| Supplier balances | Union `supplier_payables.amount`, negative `supplier_payment_allocations.amount` and negative `supplier_payment_reductions.amount`, then aggregate separately for AFN/PKR. No join fanout, cash-field summing, exchange-rate repricing or inactive filtering |
| Recent transactions | Latest six purchase creations, accepted receipts, supplier payments, reductions and stock adjustments; each source contributes at most six candidates. Sort recording timestamp, kind and UUID descending; preserve microseconds. Receipt movements are not listed again |

Amounts remain exact decimal strings. Money uses two decimals and kg three;
neither passes through JavaScript floating point. Recent payment amounts are in
the settled debt currency; purchase creation does not recognize supplier debt.
Source links open the purchase/receipt, selected payment, supplier statement or
product stock history. Recent activity is a source-record overview, not a full
audit/lifecycle event reader. Times are labelled UTC.

Each dataset is gated on its own permission before its query runs. Warehouse roles
see purchases/receipts and stock, without supplier balances/payments. Sales sees
stock and stock adjustments, without supplier/purchase identifiers or money.
Owners/admins/managers/accountants/viewers retain their explicit matrix grants;
creation/payment actions require their separate write permissions. Restricted
sections explain the access boundary; they never masquerade as zero balances.
Any query outage renders a safe error with retry rather than invented zeros.

## Changed files

- `src/db/dashboard.ts`, `.test.ts`, `.integration.test.ts`: reader and boundary,
  reconciliation, permission and isolation coverage.
- `src/app/(app)/dashboard/page.tsx`, `loading.tsx`, `error.tsx`, `ui.test.tsx`:
  server-rendered overview, shared progress/retry and screen coverage.
- `src/app/(app)/workspace-pages.test.tsx`: keep staff access checks on settings;
  the dashboard now has its own domain-data screen tests.
- `src/auth/protected-pages.test.ts`: route the existing dashboard guard fixture
  through its new reader while retaining permission denial/acceptance checks.
- `.github/workflows/ci.yml`: include the dashboard in disposable PostgreSQL CI.
- `docs/architecture.md`, `docs/testing.md`, `docs/README.md`, the build plan and
  this handoff: module map, coverage and delivery order.

## Pre-validation review

Applied Ponytail review to the complete task diff and connected authorization,
schema, stock/account calculations, navigation destinations and tests. A bounded
read-only GPT-6 Luna review independently covered the same scope and found no
concrete bug/security findings. Main-agent review confirmed tenant binding on
every source, per-dataset queries, exact arithmetic, safe framework control flow,
constant query count and read-only failure behavior. Before final checks, tightened
transaction types to encode source links and fixed money/kg display scales;
rechecked those paths and their tests. The first full test run exposed an outdated
protected-page mock importing the new server-only reader; updated its boundary
fixture and reviewed its denial/acceptance assertions. No unresolved must-fix findings.

## Verification

- Baseline before editing: lint, typecheck, 789 database-free tests and build passed.
- Test-first evidence: dashboard boundary tests first failed on the absent reader;
  screen tests first failed against the old dashboard. Focused boundary/screen
  checks then passed, including exact figures, safe errors and restricted roles.
- 13 focused isolated PostgreSQL cases pass; data is synthetic and cleaned by
  tracked tenant IDs in `afcs_task07_verify` only.
- Final `npm run lint`, `npm run typecheck`, `npm run test` and `npm run build`
  passed. Database-free run: 61 suites/808 tests passed; 263 opt-in PostgreSQL
  cases skipped in that run. The separate combined PostgreSQL run passed all
  14 suites/263 tests, including the 13 dashboard cases. Production dependency
  audit passed with zero vulnerabilities; final diff/security checks passed.
- Local actual-component fixtures: 48 layout cases at 1440, 390 and 320px in
  LTR/RTL; eight focus/navigation checks; actual error retry activated by keyboard.
  No page overflow, text clipping or control target failures. Ignored artifacts:
  `artifacts/task28-dashboard/` (screenshots, reports, fixtures and scripts).
- Taste source lint: zero failures/warnings. Rendered inspection at 1440/768/390:
  zero failures. Two explained warnings: independent capped stock/activity lists
  have different heights; the existing ADR 0020 shared header keeps its phone size.
  The frontend design evidence checker passed; populated desktop/phone and long
  320px RTL screenshots were visually inspected.
- Design: achromatic-ledger seed 908398524, no redraw. Existing ADR 0020 tokens,
  system font, labelled shell and blue action take precedence over the dealt
  finance/account composition. Exact ledger figures and receipt/stock/debt sources
  give this overview its face. No chart or sample business data is shipped.
- `EXPLAIN (ANALYZE, BUFFERS)` checked all four metric queries against an empty
  synthetic verification tenant: 0.098–0.448 ms execution in the final probe.
  This is query validity/small-fixture evidence, not a large-history benchmark.

## Limitations and next task

Remote CI/review, live Clerk sign-in, translated Pashto terminology, deployed
rendering and real pilot reconciliation remain separate, unverified evidence.
No coverage tooling or full provider-backed browser suite was added. Recorded
stock still excludes ordinary outgoing stock; the physical-count notice remains.
No live pilot gate is closed by this dashboard.

**Next task: 30 — user-facing errors, request IDs and structured server logs.**
Task 29 reports/CSV and Tasks 16/23–24 remain deferred in the pilot delivery order.
