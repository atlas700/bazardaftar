# Task 20 — Accepted receipts, stock movements, and supplier payables

Date: 3 November 2026. Branch: `feat/20-accepted-receipts`.
Implementation and local acceptance complete; ready for GitHub review.

## Authorization and acceptance scope

The founder requested the next build-plan feature in this thread. Task 19 is
merged as PR #39; Task 20 follows accepted ADRs 0003/0006/0012/0016/0019/0020.
G1 retains its accepted retrospective basis, Task 16 remains deferred, and live
pilot sign-in, terminology and deployment/restore gates remain open.

- Owner/admin/manager/warehouse accept positive goods against an ordered or
  partially received purchase. Draft, cancelled and completed purchases reject
  acceptance. Purchase editing/cancellation never changes posted receipts.
- Partial goods within agreed remaining quantities leave the purchase open.
  Excess quantities and explicit final short delivery require the accepting
  owner's explicit approval and 1–500-character reason. Approval identities/time
  are persisted. Full quantities close automatically; final short delivery closes
  only with approval. A positive physical receipt is required: zero-goods closure,
  delegated approvals, corrections, returns and reopening are excluded.
- Server-derived tenant/actor, Zod input, organization/purchase/line row locks,
  fresh provider/local role checks and revision guards protect every write/replay.
  Active tenant-owned supplier, warehouse, product, stock/quantity/price measures
  are rechecked inside the transaction. Changed provider or queued revoked grants
  deny access. Request replay never restores revoked variance authority.
- Entered measures/actual bag weights and normalized whole grams are stored.
  Saved selections keep ordered names/weights; new receipt measure selections
  use current catalogue definitions. Price, price weight and currency always
  come from the agreement. Accepted cumulative values use exact integer/decimal
  arithmetic and per-line half-up reconciliation under ADR 0019.
- Receipt, lines, cumulative cursors, inbound movement per line, one receipt
  payable, and purchase status/revision commit together. Failed writes roll back
  everything. Unique source/request constraints and serialized quantity/value
  checks prevent duplicate stock/debt and unauthorized excess.
- `/purchases/[id]/receive` uses existing controls/tokens, confirmation, labelled
  fields, preserved values, native capture reset protection, pending controls,
  focused linked errors and organization/purchase/revision form identity.
  Purchase detail shows partial/received status, accepted weights/recognized debt,
  receipt references/history and owner variance reasons. Read-only users retain
  authorized history; received purchases offer no cancellation action.

## Changed files and migration

- `src/db/receipts.ts` and its unit/integration suites own acceptance, validation,
  snapshots, current authorization, durable replay and atomic posting.
- `src/db/schema/index.ts`, generated `drizzle/0011_accepted_receipts.sql` and
  snapshot/journal add four tables and default-zero purchase-line cursors.
- `src/db/purchases.ts` extends consistent detail reads and permission flags.
- `src/app/(app)/purchases/` adds receipt action/form/route/history and tests,
  received-state presentation, per-line cumulative facts and safe controls.
- Existing PostgreSQL CI adds the receipt suite. README, docs index, build plan,
  API/database/testing docs and this note describe the delivery.

Movement fields: organization, receipt-line source, product, warehouse, positive
kg, `receipt` kind, performer membership/user, UTC time. Payable fields:
organization, unique receipt, supplier, purchase currency, exact amount and UTC
time. Receipt-line FKs bind movement product/kg; receipt FKs bind payable
supplier/currency/amount. Stock remains the movement sum, not a purchase counter.

Use the full database-generated receipt UUID as its visible reference. A unique
organization/request UUID plus normalized SHA-256 command fingerprint provides
durable idempotency, including after later receipts. Sorted line identities make
input order immaterial. Changed commands and stale fresh requests conflict.
Reloading starts a fresh request: inspect history before retrying uncertain entry.

Apply migration 0011 before this application revision. It was applied/reapplied
to local `afcs_task07_verify` and `afcs_dev`; both retain all prior ledger rows
and now contain 12 migration entries. No business fixtures were added to development.
Reviewed SQL installs new
referenced unique constraints before foreign keys; old migration files/ledger
entries are preserved. New default-zero cursors preserve existing agreements.
Application rollback must retain receipt-aware reads, disable acceptance, and
keep all posted ledgers. No dependency or provider/deployment setup is added.
Pre-existing AGENTS/skills-lock/ECC changes remain excluded from feature commits.

## Test-first evidence

- `d3eefb9` records the input/posting specifications and the expected missing
  receipt-service module RED. `f30f819` implements the transaction; 18 input cases
  and the initial 17 isolated PostgreSQL cases pass.
- `375769e` records expected missing receipt action/form module RED. Implemented
  action/form cases pass. Expanded database tests cover remaining state, exact
  snapshot, permission, concurrency and constraint boundaries.
- Ignored `artifacts/task20-receipts/` contains the actual-component renderer,
  headless layout/interaction runner, captures and local database verification.
  Hydrated interactions establish linked quantity errors after real submission,
  retained Radix/bag values, same-business retry identity and business-switch reset.

## Pre-validation review

Ponytail Review covers the complete feature diff and connected actor/provider
guards, purchase mutations, catalogue/stock primitives, generated SQL, actions,
form reset/transport, receipt reads and tests. Assumed the small invited pilot
with concurrent writes across processes. Traced role/state/replay pairs, tenant
FKs, active references after locking, cumulative quantity/value bounds, zero
debt, partial/final variances, atomic failure paths and keyboard/RTL recovery.

Resolved findings: generated SQL initially placed new referenced unique
constraints after their foreign keys; reordered before applying. Linked inline
errors and unavailable measure labels are explicit; receipt timestamps are
isolated LTR in RTL history. Reused the existing native reset guard so React
action resets retain controlled Radix choices. Rechecked affected paths; no
unresolved task-specific must-fix finding remains before final validation.
Task 27 has an explicit transaction-local audit integration point; acceptance
and owner approval provenance already persist in the receipt.

## Verification and limitations

- After pre-validation review: `npm run build`, `npm run lint`,
  `npm run typecheck` and `npm run test` pass. Default database-free tests report
  **648 passed, 150 opt-in database tests skipped**. The build includes the new
  dynamic receive route. No coverage percentage or live-provider evidence is claimed.
- All eight isolated PostgreSQL suites pass **150 tests**, including **34 receipt
  cases** and all 41 purchase regressions. The first combined validation run
  saturated local resources: two existing product/supplier constraint cases hit
  their default five-second timeout. Running the identical database command
  without simultaneous build-quality processes passes all 150 in 9.64 seconds;
  no test timeout/configuration was changed. Failed-run synthetic fixture cleanup
  is scoped to its known verification-only organization.
- Migration apply/reapply preserves earlier ledger entries in both local databases;
  schema generation reports no drift. Prior migration SQL is unchanged. Existing
  disposable PostgreSQL CI now runs the receipt suite; remote evidence is separate.
- **84** actual-component layout/label/description/control checks pass across
  14 states, LTR/RTL and 1440x900, 390x844 and 320x844. **15** hydrated checks pass
  for confirmation/dismissal, actual bag measure/weight, explicit owner approval,
  retained values/selectors, focused linked errors, pending state, durable form
  request identity, business-switch reset and permission controls. No browser
  exceptions occurred. Desktop form and narrow RTL receipt-history captures were
  inspected. Fixtures/actions/provider identities are synthetic.
- Taste source lint reports **0 failures, 0 warnings**. Rendered inspection flags
  the existing 320px scrolling navigation's edge text, the shared 30px mobile
  PageHeader (ADR 0020 takes precedence), and a 50px form separation band. These
  are reviewed layout observations, not new financial/control defects; independent
  checks find no page overflow or broken labels/description targets. Existing
  tokens, system fonts, Radix controls, 44px targets and RTL shell are retained.
- `npm audit --omit=dev --audit-level=high` reports **0 vulnerabilities**.
  Security-pattern review finds no float money calculation, interpolated SQL,
  client authority or sensitive error logging. Whitespace and 152 local Markdown
  link-path checks pass across seven changed documents.

Applied project-local find-skills, product-lens/search-first (inline reuse search),
frontend patterns/direction, accessibility, PostgreSQL/security/test-first/E2E and
verification guidance, both mandatory design skills, Ponytail full/review and PR
guidance. Context7 and installed Next.js 16.4.2 mutation/form guides informed
framework/transaction boundaries; Vitest 4.1.12 docs informed timeout diagnosis.
UI/UX Pro Max's focused form/confirmation search informed recovery controls.
Existing exact helpers/components were reused; no new dependency or extra thread
was needed.

All provider identities/actions in tests are synthetic. Live Clerk, real
provider-backed receipt UI, translated-term usability and deployment smoke are
unverified. Full E2E infrastructure remains Task 33. Pilot history loads in full;
paginate before large history. Payments, supplier statements, inventory balances/
history screens and stock corrections remain later tasks.

Next: **Task 21 — inventory balances and stock history read models**. Aggregate
signed kg movements by tenant/product/warehouse, retain ledger truth and tenant
filters, add paginated history and only demonstrated query indexes. Task 20
currently supplies inbound receipt movements only; later corrections/dispatch
must extend movement kinds deliberately. Do not claim real closing stock until
the pilot's outgoing-stock reconciliation gate is resolved.
