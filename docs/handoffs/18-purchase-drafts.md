# Task 18 — Purchase order drafts

Date: 2 November 2026. Branch: `feat/18-purchase-drafts`.
Implementation and local acceptance complete; ready for GitHub review.

## Authorization and completed acceptance

The founder requested implementation after reviewing Task 18's scope. G1 remains
accepted on ADR 0003's retrospective basis; Task 16 customers remains deferred.
ADRs 0016/0019 govern permissions and exact numeric rules. No new domain policy,
dependency, provider configuration, or release-gate closure is introduced.

- `/purchases`, `/purchases/new`, and `/purchases/[id]` provide the register,
  multi-line creation, and historical detail. Navigation marks purchases available.
  Owner/admin/manager can create. Warehouse/accountant/viewer can read. Sales
  cannot access purchases. Missing setup leads to contextual setup actions.
- Zod validates 1–100 lines, tenant-owned active supplier/warehouse/products,
  active product default units and both selected measures, positive quantities,
  non-negative prices, and AFN/PKR. Bags require actual gram-precise weights;
  quantity and price measures can differ. Quantities convert exactly to whole
  grams. Decimal strings and existing bigint helpers calculate half-up line
  totals first, then sum those rounded amounts; no floating-point money.
- The server owns tenant, actor, status and totals. The organization lock is
  acquired before current provider identity/local grant and active-reference
  checks on that transaction connection. Header/items insert atomically. Invalid
  later lines and injected item-write failure leave no partial draft.
- A per-tenant unique request UUID and normalized-command fingerprint make
  concurrent/ambiguous retries return one saved draft. Changed contents conflict;
  a new UUID permits another agreement. Replays still require current authority.
- Persist supplier/warehouse names and product/code, entered quantity, unit kind,
  actual/fixed measure weight, total kg, agreed price, separate price measure/kg,
  line totals, currency, actor membership/user, and UTC creation time. Later
  catalogue/contact changes do not rewrite the agreement.
- Shared tokens/components, translatable labels, logical RTL spacing, isolated
  numbers, stable line keys, retained values/selections, linked focused errors,
  disabled pending controls, and safe correlated recovery follow ADR 0020.

## Status meaning and scope

Only `draft` can be created or stored by this task: an intended supplier agreement,
with no stock movement or supplier debt. The database rejects client-provided or
unsupported states. Task 19 adds editing, `ordered` (committed agreement), and
cancellation under its approved transition/authority rules. Task 20 introduces
`partially_received` and `received` from accepted deliveries and reconciles stock
and payable posting. These later states and controls are not implemented here.
No historical deletion or receipt/payment mutation is exposed.

## Changed files and migration impact

- `src/db/schema/index.ts`, `src/db/purchases.ts`, unit/integration tests: exact
  storage, tenant reads, validated/serialized creation and replay handling.
- `drizzle/0008_purchase_drafts.sql`, `0009_exact_purchase_line_check.sql`, their
  generated snapshots/journal: additive order/item tables, composite tenant FKs,
  reference uniqueness, request uniqueness and numeric checks. Existing migrations
  remain unchanged. Reviewed 0008 puts referenced unique constraints before FKs.
- `src/app/(app)/purchases/`: create/list/detail, form, number formatting,
  action, loading/error/not-found states, action/UI tests. Navigation availability
  and protected-route tests are updated; no other workflow is implemented.
- `.github/workflows/ci.yml` adds purchases to the existing disposable PostgreSQL
  job. README, build plan, database/API/testing docs, docs index and this handoff
  describe the delivery. Pre-existing AGENTS/skills-lock/local ECC installation
  changes are excluded from Task 18 commits.

Apply both migrations before using purchases. They were applied/reapplied locally
on `afcs_task07_verify` and `afcs_dev`: ten ledger entries each, previous hashes and
timestamps preserved. No synthetic purchase data was seeded into development.
Corrections use forward migrations; application rollback retains additive tables.
Task 19 must expand the draft-only database constraint with its transition work.

## Design contract and rendered evidence

Screen question: “What goods, quantities and price did we agree with this
supplier?” The register leads to saved agreements; creation pairs quantity and
separate price measures; detail foregrounds the agreed total and durable weight
snapshots. Existing catalogue/supplier/warehouse pages are local references.
Keep the shared BazarDaftar shell, system typography, blue primary action, semantic
tokens, 44px controls and Pashto/RTL support. No invented metrics or charts.

Applied find-skills, Ponytail full/review, Context7, product-lens, search-first,
frontend-patterns, frontend-design-direction, accessibility, postgres-patterns,
security-review, tdd-workflow, e2e-testing, verification-loop, deployment-patterns,
PR guidance, and both mandatory design skills. Search-first's read-only researcher
confirmed existing exact helpers, transaction guards and components are sufficient;
no dependency was added. Current Next.js/React/Drizzle docs and installed Next.js
guides informed Server Action, transaction and recovery boundaries.

Taste app draw: `achromatic-ledger`, seed `1583851910`, palette/type retained.
Its ledger treatment fits this agreement; the paired quantity/price weight facts
give it a trading-specific subject. ADR 0020 overrides generic shell/font/radius
and primary-action suggestions. UI/UX Pro Max's focused validation/Server Action
searches guided retained values, linked errors and pending feedback.

Ignored `artifacts/task18-purchases/` contains actual-component fixtures, screenshots,
layout/interaction/taste results, design evidence, and local database scripts.
Fixtures use synthetic records and mocked provider/action boundaries. Source lint
in app mode has zero failures/warnings. Rendered probe dispositions: mobile 30px
titles retain shared PageHeader; 320px edge-text belongs to intentionally clipped,
scrollable compact navigation; the single-row register leaves intentional empty
page space; a 42px form band separates agreement details from line fields. Detail
desktop probes have no findings. No page overflow or control failure was found.

## Pre-validation review

Reviewed the complete Task 18 diff and connected permission/provider/tenant guards,
staff/catalogue/supplier/warehouse lock patterns, exact numeric helpers, schema and
SQL/snapshots, selectors, action transport, form/recovery, navigation, tests, CI and
documentation using Ponytail Review. Assumed the small invited pilot with concurrent
requests across processes. Traced untrusted input, bound SQL, role/tenant denial,
fresh identity/grants, active references, rollback, replay conflicts, overflow,
rounding, historical reads, safe errors, keyboard focus, RTL and browser refresh.

Resolved findings: intermediate PostgreSQL division precision, whole quantity
display, wrong overflow field, changing retry ID across same-business refresh,
native selector reset after actions, and stale navigation availability. The retry
ID is retained in form state, and the form is keyed by server-verified organization
ID so business switching resets it. A native capture listener cancels action
resets before Radix reset listeners; React synthetic reset handlers do not run
during that commit. Failed checks were repeated after these fixes. Added real
price-bag snapshot and aggregate-overflow cases during review. No unresolved
must-fix finding remains. The pilot-size register shortcut is explicit in source.

## Test-first and review evidence

- `c6df751` and `e3ab27b`: missing service/action and PostgreSQL service imports
  fail before implementation. `a8f08ee`: valid missing-detail-module UI RED;
  earlier UI setup failures are not counted as feature evidence.
- `a9c33fb`: an actual PostgreSQL near-half-cent ratio rejects the correct
  `0.00` total because division rounds the intermediate ratio to a tie. Migration
  0009 uses exact quotient/remainder half-up arithmetic. The regression passes.
- `69230d0` captures whole quantity `10` displaying as `1` and price overflow
  highlighting quantity. `c73605b` fixes both; UI and database regressions pass.
- Hydrated actual-form check in ignored `artifacts/task18-purchases/check.cjs`
  fails after invalid submission: supplier/product/measure selectors become
  `Choose…` while quantity/price remain. A second submission cannot proceed.
  The assertion expects `Helmand Grain`, receives `Choose…`. This is real native
  form-reset behavior with a mocked action, not live provider evidence.
  `f0001b7` fixes it; the same hydrated regression and retry checks pass.
- `6d4a79f` fails because purchases still says `Soon`; `244ed2e` makes desktop and
  mobile navigation agree with the implemented workflow.

## Verification

- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`: pass after
  review and fixes. Database-free suite: **599 passed, 96 opt-in tests skipped**.
  Production build includes dynamic register/create/detail purchase routes.
- All seven isolated PostgreSQL suites: **96 passed**, including **21 purchase
  cases**. Exact rounding, separate bag-price weight, aggregate overflow, atomic
  rollback, snapshots, all roles/tenant selectors, inactive references, concurrent
  retries/conflicts and queued revocation pass. Clerk identities are mocked.
  Migration repeat-application and preservation of prior ledger rows pass.
- Fixtures remove their own records. An early failed-migration attempt left 16
  Task 18 test organizations; targeted cleanup removed only those generated
  fixtures from the isolated database. Following full suites leave zero Task 18
  fixtures; other records are untouched.
- **84** actual-component LTR/RTL layout/label/44px-control checks pass at
  1440x900, 390x844 and 320x844. **14** hydrated checks pass: keyboard selection/
  submission, separate bag measures, stable removal, linked/focused errors,
  retained values and selectors, aligned fields without authority/totals, stable
  retry ID across refresh/error, disabled pending controls, business switch reset,
  fixed/bag weight clearing, reduced motion and no browser exceptions.
- Taste app source lint: **0 failures, 0 warnings**; rendered probe dispositions
  are above. Inspected desktop detail/create and narrow RTL/long-content captures.
  Existing core text/action token contrasts meet 4.5:1 on white. Design evidence
  checker passes. Markdown links/anchors and feature whitespace checks pass.
- `npm audit --omit=dev --audit-level=high`: **0 vulnerabilities**. No dependency
  changes or new test tooling. No coverage percentage is claimed.

GitHub CI/review state is reported separately at PR delivery. Live Clerk,
provider-backed application mutations, Pashto terminology usability, and deployment
smoke were not performed. These existing pilot-release gates remain open.

## Limitations and next task

The small pilot register loads history in full; paginate before large trading
histories. Refresh within the same business retains unsaved selections and retry
identity; a full reload starts a new draft, so inspect the register first after an
unknown outcome. Creation does not establish receipt eligibility or posting
authority. Task 20 must recheck and reconcile its own transaction. Task 15's
adjacent product/catalogue hidden-ID follow-up remains separate.

Next: **Task 19 — purchase order editing, ordering, and cancellation**.
Task 16 remains deferred under ADR 0003.
