# Task 22 — Controlled inventory adjustments

Date: 5 November 2026. Branch: `feat/task-22-inventory-adjustments`.
Implementation and local acceptance complete; ready for GitHub review.

## Authorization and policy

The founder requested the next feature after Task 21 merged as PR #41. The
Task 21/build-plan note describing an unresolved negative-stock policy was stale:
accepted ADR 0007 already forbids negative stock, while ADRs 0010/0016 require
explicit owner approval and owner-only `inventory.correct`. The founder's final
instruction confirms the recommended approach: block adjustments below zero.
No exception to those policies is implemented. G1 retains its accepted retrospective
basis; the physical outgoing-stock, terminology, sign-in and deployment gates remain.

As an owner, record opening stock, loss, spoilage or a count correction with a
reason; see the exact signed movement and its provenance in inventory history.
Other roles retain stock reads but cannot load adjustment options or post a
correction. No other numbered task is implemented.

## Completed acceptance checks

- [x] Owner-only entry and service; all six other roles are denied server-side.
- [x] Explicit approval and a 1–500 character reason are required on every command.
- [x] Exact signed kg with one-gram precision; zero, malformed, excessive-precision
  and out-of-range quantities are rejected before database writes.
- [x] Reason codes: `opening_stock` adds; `loss` and `spoilage` deduct;
  `count_correction` may add or deduct. Optional external references allow up to
  100 characters; every saved movement also has its own UUID reference.
- [x] Negative stock is blocked, including a one-gram overdraw from empty stock.
  A deduction to exactly zero succeeds. Concurrent deductions cannot overdraw.
- [x] The service derives tenant/actor authority, locks the organization, and
  rechecks Clerk identity plus the local owner grant on the transaction connection.
  Foreign, missing and inactive products/warehouses cannot be posted.
- [x] Request UUID/fingerprint replay returns the original movement; changed
  payloads conflict. Authorization is rechecked before replay, and subsequent
  product deactivation does not break an authorized unchanged retry.
- [x] Ledger rows retain reason/type/reference, product/warehouse name snapshots,
  performer membership/user IDs and UTC recording time. Posted rows have no edit
  or delete command. Supplier payables and purchase agreements remain unchanged.
- [x] Stock history includes both receipts and adjustments, correct signs,
  provenance and unchanged product-scoped keyset pagination. Stock reads disclose
  no prices/supplier data; purchase links remain permission-dependent.
- [x] Accessible empty/recovery/pending/error states, keyboard selectors,
  confirmation, linked focused errors, retained values and stable request identity.
  Form identity follows the verified business; switching business clears drafts.

## Changed files and migration

- `src/db/inventory-adjustments.ts` supplies the guarded command and active options.
  `src/db/inventory.ts` extends history with tenant-scoped left joins, correction
  snapshots/metadata and the existing correction permission's visibility flag.
- `src/db/schema/index.ts`, generated `drizzle/0013_inventory_adjustments.sql`,
  its snapshot and journal extend the existing ledger rather than adding a balance
  table. The nullable receipt source is guarded by conditional source checks;
  receipt uniqueness/composite FK remain, with new request uniqueness, signed
  quantity/metadata constraints and a tenant/product FK for adjustments.
- `src/app/(app)/inventory/adjust/` adds the page/form and screen cases;
  `adjustment-actions.ts` validates scalar cardinality, handles safe recovery,
  invalidates inventory and redirects to product history. `inventory/page.tsx`
  renders signed provenance and the owner entry action.
- New service/action/PostgreSQL tests and expanded inventory read/screen tests
  cover the acceptance cases. `.github/workflows/ci.yml` includes the new isolated
  suite. README, documentation index, build plan, database/API/testing guides and
  the previous handoff's next-task note describe the delivered scope.

Migration 0013 applies/reapplies on local verification and development databases;
development retains its ledger/payable row counts and has 14 migration entries.
Generation reports no schema drift. Existing receipt rows need no backfill or
deletion; no development business fixtures are introduced. After adjustments are
posted, rollback must retain a reader supporting signed adjustments. Do not
delete adjustments or restore receipt-only constraints as an application rollback.

## Test-first evidence

- `bcc2998` captures missing service/action module failures for the command's
  invalid-input/authorization cases and action forwarding/refresh/error cases.
- `8ea03bf` captures the absent adjustment service against PostgreSQL specifications
  for exact stock, concurrency, replay, role/tenant denial and durable provenance.
- `76ea0a5` captures the existing inventory screen failing when an adjustment has
  null receipt quantity fields, alongside adjustment page specifications.
- The implementation passes those cases, expanded provider identity/constraint
  checks and mixed receipt/adjustment history. Final default tests pass **702**
  cases, explicitly skipping **182** opt-in database cases. The separate isolated
  PostgreSQL command passes all **182 cases across ten suites**, including
  **16 adjustment cases** and **16 inventory read cases**.

## Pre-validation review and UI evidence

Ponytail Review covered the complete Task 22 change and connected tenant/role
guards, receipt writers, exact decimal helpers, schema/generated SQL, inventory
queries, form/action callers, fixtures and CI. Assumed the small invited pilot
with concurrent owner/receipt writers. Reviewed bound SQL, source-check null
semantics, role/provider changes while queued, request replay, active references,
aggregate precision beyond entry bounds, timestamp ordering, read permissions,
safe errors, nullable receipt fields, pagination and keyboard/RTL recovery.

All must-fix findings were resolved and rechecked before final quality commands:
long product/warehouse names now wrap on phones; error-summary links have 44px
targets; product/type selectors have initial labels before hydration; the active
reference recovery link reloads its options; timestamps are recorded after lock
acquisition rather than inheriting transaction-start time. No unresolved must-fix
finding remains. The conditional receipt checks retain existing receipt safety.

The UI follows ADR 0020 and existing workspace tokens/components, Taste's app-screen
workflow, UI/UX Pro Max's focused form-accessibility guidance, and shared Radix
selectors. Ignored `artifacts/task22-adjustments/` contains actual-component
rendered fixtures and a bundled real form with mocked action/provider boundaries:

- **48 layout checks**: eight states, LTR/RTL, 1440/390/320px. No page overflow,
  clipped main text, missing input labels or short main touch targets remains.
- **14 hydrated interaction checks**: confirmation cancellation/acceptance,
  explicit approval and submitted values, retained fields/selectors, focused
  linked errors, stable same-business retry UUID, pending controls and business reset.
- Taste source lint reports zero failures/warnings. Render inspection reports
  zero failures and one defended `panel-void` warning: the 42px context-to-label
  spacing in a single naturally sized form, not a stretched empty card. Existing
  shell `edge-text` and ADR 0020 `app-title-size` allowances are explicit.
  Desktop and phone screenshots were inspected after the fixes.

These are synthetic English-copy fixtures with RTL layout and some Pashto product
text, not a live authenticated Clerk session or proof of translated terminology.

## Final verification and limits

After pre-validation review, `npm run build`, `npm run lint`, `npm run typecheck`
and `npm run test` pass. Build includes dynamic `/inventory/adjust`. The isolated
PostgreSQL suite runs separately from the build. Migration repeatability,
schema-generation drift, whitespace and changed-document link checks pass.
`npm audit --omit=dev --audit-level=high` reports zero vulnerabilities. Focused
security review finds no client authority, unsafe SQL construction, floating-point
stock conversion, unsafe HTML or sensitive exception logging in the new paths.

Remote CI is pending GitHub execution; local checks do not establish live Clerk,
provider, deployment or terminology acceptance. Coverage percentages and full
provider E2E are not measured; existing coverage tooling is unchanged. Quantity
entry is deliberately kg only. Inactive references must be reactivated before a
new correction. Existing small-pilot balance/options lists remain unpaginated.
General audit-event persistence remains Task 27; the movement itself holds Task
22's durable correction trail. Physical outgoing-stock reconciliation remains an
open pilot gate. Transfers, returns, ledger editing/deletion, valuation and sales
are deferred. Unrelated agent instructions/skill changes are preserved outside
the feature commits.

Next: **Task 25 — record and allocate supplier payments** under ADRs 0009/0019.
Task 16 customers and Tasks 23–24 sales remain deferred under ADR 0003.
