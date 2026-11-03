# Task 19 — Purchase order editing, ordering, and cancellation

Date: 3 November 2026. Branch: `feat/19-purchase-lifecycle`.
Implementation and local acceptance complete; ready for GitHub review.

## Authorization and completed acceptance

The founder instructed implementation after reviewing Task 19's scope. The build
plan and ADRs 0003/0010/0016/0019/0020 govern this delivery. G1 remains accepted on
its retrospective basis; Task 16 customers and all existing pilot-release gates
retain their recorded status. No dependency, receipt/stock/debt feature, provider
configuration or deployment is added.

- Owner/admin/manager can edit a draft and mark it ordered. Only owner can cancel
  an unreceived draft or ordered purchase, with a required 1–500-character reason,
  explicit confirmation, stored owner membership/user, and UTC timestamp.
- The complete current matrix is: draft edits allowed, `draft → ordered`,
  `draft → cancelled`, `ordered → cancelled`; ordered edits/reordering and every
  cancelled mutation are denied. Ordered/cancelled agreements remain readable;
  cancellation has no reopen/delete operation. Receipt states are absent.
- Server-derived tenant/actor, Zod input, organization lock, fresh provider/local
  authority on the transaction connection, tenant-owned purchase lock, and
  revision checks guard every mutation and replay. Invalid or failed writes do
  not change header, lines, state, approval or revision. Concurrent different
  submissions produce one winner; matching latest retries return its saved ID.
- Draft editing reuses exact quantity/weight/money validation and preserves
  surviving line IDs. Unchanged reference selections keep saved names, kinds and
  measure weights; explicit new selections use current active catalogue data.
  Separate quantity/price bag weights remain editable. Ordering rechecks active
  references without changing stored prices/weights/totals. Cancellation remains
  possible after references become inactive. Creation request identity is immutable.
- `/purchases/[id]/edit` reuses the draft form and retains errors/selections;
  unavailable saved references are labelled and explained. Detail/register show
  the actual status, transition times and cancellation reason. Read-only roles
  receive no mutation controls. Separate order/cancel forms prevent implicit
  Enter-key ordering. Current authority is always rechecked on submission.
- Detail header/lines are read in one repeatable-read transaction so concurrent
  editing cannot produce a mixed-version agreement. Framework exceptions remain
  intact; unexpected action/read errors expose safe recovery and correlated
  diagnostics without SQL or submitted business details.

## Changed files and migration impact

- `src/db/purchases.ts` and its service/integration tests: shared exact agreement
  resolution, transactional guards, historical selection retention, consistent
  detail reads, lifecycle matrix, revision/replay handling and approval storage.
- `src/db/schema/index.ts`, generated `drizzle/0010_purchase_lifecycle.sql`,
  snapshot/journal: additive lifecycle metadata and status/revision/approval
  checks. Prior migration files, hashes and timestamps are unchanged.
- `src/app/(app)/purchases/`: shared creation/editor, new edit route, lifecycle
  controls and status, consistent exact quantity presentation, explicit aligned
  action fields, route refreshes, status/history displays and focused tests.
- README, documentation index, build plan, database/API/testing docs and this
  handoff describe the final scope. Pre-existing AGENTS/skills-lock/local ECC
  installation work is preserved and excluded from feature commits.

Apply migration 0010 before this application revision. It was applied/reapplied
on local `afcs_task07_verify` and `afcs_dev`; each has 11 ledger entries with prior
rows preserved. No purchase fixtures were seeded into development. Corrections
use forward migrations. Application rollback retains additive schema, but old
draft-only code cannot truthfully display new ordered/cancelled records: retain
lifecycle-aware reads when rolling back a deployed workflow.

## Test-first evidence

- `201e2b8` records eight invalid-command service failures because `mutatePurchase`
  was absent. The isolated PostgreSQL suite then reported 14 missing-lifecycle
  failures alongside 21 existing passing cases. `f6838c3` implements the service;
  the expanded purchase suite passes 41 cases.
- `9b8833e` records four missing `changePurchase` action failures; they pass after
  the service/action implementation.
- `079c8cd` records missing editor/lifecycle UI modules. The intended missing-module
  RED is distinct from an unrelated build/setup failure. The implemented UI passes.
- `29b7455` captures the editor displaying renamed catalogue labels instead of its
  preserved agreement names. Retaining selected supplier/product labels fixes it.
- Ignored `artifacts/task19-purchases/lifecycle-check.cjs` exercises the actual
  hydrated components with mocked actions. With the initial shared lifecycle
  form, typing a cancellation reason and pressing Enter submits `action=order`
  without a confirmation dialog. The check expects zero submissions after a
  dismissed confirmation and observes one. This is native form behavior, not
  live Clerk/provider evidence. Separate action forms and cancellation submission
  confirmation fix this check; all ten lifecycle interactions now pass.
- `5838743` captures a saved quantity displayed with 18 trailing decimal places;
  shared exact string formatting makes the editor display `10` while preserving
  significant whole-number zeros. The same UI test passes after the fix.

## Pre-validation review

Used Ponytail Review on the complete Task 19 diff and connected tenant/provider
guards, permissions, exact numeric helpers, catalogue edits, purchase callers,
form transport/state, schema/generated SQL, tests, and documentation. Assumed the
small invited pilot with concurrent writes from multiple processes. Traced every
draft/ordered/cancelled edit/order/cancel pair, tenant filters, fresh authorization
after locking, revocation/replay, original creation retry identity, snapshot
retention, replacement rollback, metadata constraints, safe recovery, RTL,
keyboard submission and pending controls.

Resolved findings: unchanged selected supplier/product labels were showing later
catalogue names; Enter in a cancellation reason implicitly ordered the purchase;
the editor showed stored quantities with 18 trailing decimal places. Dedicated
forms and submit-time cancellation confirmation now cover mouse and Enter; exact
string formatting preserves whole-number zeros. The same regression checks pass.
Rechecked the affected paths after each fix. No unresolved must-fix finding remains.
No shared audit writer exists: the Task 27 transaction integration point is explicit,
while order/cancellation approval identity and UTC times are already persisted.

## Verification

- After pre-validation review/fixes: `npm run build`, `npm run lint`,
  `npm run typecheck`, and `npm run test` pass. The database-free run reports
  **618 passed, 116 opt-in tests skipped**. The production build includes the new
  dynamic purchase editor. No coverage percentage is claimed; no coverage tooling
  or browser framework dependency was added.
- All seven isolated PostgreSQL suites pass **116 tests**, including **41 purchase
  cases**. Coverage includes all current transition pairs and roles, fresh grant
  revocation while queued, tenant/line identity denial, active references, durable
  approvals, metadata constraints, replaced-line rollback, immutable creation
  retries, concurrent conflicts/replays, retained names/weights/kinds, exact
  rounding and the existing purchase/domain regressions. Provider identities are
  mocked. Repeat migrations preserve prior ledger rows; generation reports no
  schema drift.
- **138** actual-component LTR/RTL layout/label/control checks pass at 1440x900,
  390x844 and 320x844 across 23 content states. **24** hydrated checks pass: the
  existing 14 creation regressions and ten lifecycle/editor interactions, including
  Enter-key cancellation confirmation/dismissal, manager ordering, saved bag/price
  measures, line identities, retained selectors/values, error focus, pending fields
  and no browser exceptions. Actions/data are synthetic; no live provider claim.
- Taste app source lint has **0 failures, 0 warnings**. Local rendered probes were
  reviewed: shared mobile PageHeader remains 30px under ADR 0020; the editor's 42px
  band separates agreement details from lines; 320px edge-text findings belong to
  the existing intentionally scrolling compact navigation. Task-specific desktop
  detail/ordered/cancelled probes have no findings. Inspected wide editor, narrow
  RTL detail and unavailable-reference captures; layout checks find no page
  overflow. Existing text/action contrast tokens are retained. The local design
  evidence checker passes.
- `npm audit --omit=dev --audit-level=high` reports **0 vulnerabilities**.
  Focused security-pattern and whitespace checks pass. Local Markdown link-path
  validation passes across changed documents. No CI configuration changed; the
  existing disposable PostgreSQL job already runs the expanded purchase suite.

Ignored `artifacts/task19-purchases/` contains the renderer, data fixtures,
screenshots, layout/interaction results, Taste probes, design evidence and local
verification scripts. These are local synthetic acceptance artifacts. GitHub
CI/review state is reported separately at PR delivery. Live Clerk, real provider-
backed mutations, Pashto terminology usability and deployment smoke were not run.

## Design contract and skill use

The screen answers: “What agreement is saved, and can it be edited, ordered or
owner-cancelled?” Its trading-specific facts are the independent saved quantity
and price weight bases beside the agreed total. Reuse the existing BazarDaftar
shell/system font, blue primary action, tokens, 44px controls and RTL layout.
Taste app draw: `achromatic-ledger`, seed `2119064303`, palette/type retained;
ADR 0020 governs shell, font, radius and primary-action differences. No redraws.
No invented metrics, charts or new visual system were added.

Applied find-skills and project-local product-lens/search-first, frontend patterns,
frontend design direction, accessibility, PostgreSQL patterns, security review,
test-first workflow, E2E guidance and verification loop, plus Ponytail full/review,
Context7, both mandatory design skills and PR guidance. Search-first's read-only
researcher recommended existing helpers/components and no dependency. Current
Next.js/React/Drizzle documentation and installed Next.js 16.4.2 mutation/form
guides informed transaction, action and form behavior. UI/UX Pro Max focused
confirmation/recovery and Server Action searches informed interaction choices.

## Limitations and exact next task

The most recent mutation request can replay; after a later mutation, old revisions
conflict safely. A full reload creates a fresh request ID: inspect current state
before re-entering an uncertain edit. To adopt a changed catalogue definition for
an existing selected measure, use a new selection/line; unchanged selections keep
their historical definition. The pilot register's existing full-history limit
remains explicit. Task 27 must append complete lifecycle audit events at the
marked transaction point; existing order/cancellation approval is already stored.

Next: **Task 20 — accept receipts, append stock movements, and create supplier
payables**. Its preconditions are an ordered tenant-owned purchase (later partial
receipts add `partially_received`), current `receipts.accept` authority and active
supplier/warehouse/product/unit references rechecked inside its transaction.
Cancelled/draft purchases are ineligible. Expand the database status/metadata
checks, advance revision/replay metadata consistently, keep stable ordered line
IDs and saved quantity/price/currency snapshots, and serialize remaining-quantity
and cumulative-value reconciliation. Owner approval remains required for
variances. Commit receipt, movements, payable and status together with unique
receipt requests; Task 19 establishes no stock or debt posting authority.
Task 16 customers remains deferred under ADR 0003.
