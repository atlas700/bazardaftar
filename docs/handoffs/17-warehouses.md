# Task 17 — One warehouse per business

Date: 1 November 2026. Branch: `feat/17-warehouse`.
Implementation and local acceptance complete; ready for GitHub review.

## Authorization and completed acceptance

The founder requested Task 17 after reviewing its scope. G1 is accepted on the
retrospective basis recorded in ADR 0003. Task 16 customers remains deferred.
ADR 0003 limits the pilot to one warehouse; ADR 0016 already grants basic business
settings reads to all seven roles and management to owner/admin. No new permission
or domain policy is introduced. Pilot sign-in, terminology, outgoing-stock,
deployment, restore, and operational evidence gates remain open.

- `/settings/warehouse`, linked from Settings, provides first setup, read/edit,
  confirmed deactivation, and explicit reactivation of the same stable record.
  Owner/admin can manage; other approved roles can read without write controls.
- Store a generated UUID, organization FK, required trimmed name (1–80 characters),
  optional trimmed location (up to 200 characters, blank becomes null), and active
  state. A unique organization constraint includes inactive rows. Repeated/concurrent
  setup returns `exists`; it cannot overwrite or create another warehouse.
- The singleton is retained on deactivation and can be edited while inactive.
  Reactivation retains its UUID. No deletion, switching, transfers, bins, purchase
  records, receipts, or stock quantity is added.
- `getActiveWarehouse()` returns only the current verified tenant's active record,
  or null before setup/while inactive. This is selection preparation; Task 18 and
  later posting services must enforce their own permissions and recheck active
  ownership within their write transaction.
- Actions authenticate, validate untrusted scalar fields server-side, and derive
  authority from current verified membership/local roles. Mutations acquire the
  organization lock shared with staff, then recheck provider identity and the local
  grant on that transaction's connection. Foreign IDs/stale status changes conflict;
  caller tenant/role/active flags cannot establish authority.
- Shared controls/tokens, logical spacing, translatable copy, input direction,
  retained values, linked errors with focused summary, disabled pending writes,
  live feedback, and safe correlated recovery follow ADR 0020.

## Changed files and migration

- `src/db/schema/index.ts`, `src/db/warehouses.ts`, colocated unit/integration tests:
  singleton storage, bounded commands, tenant-scoped reads and locked writes.
- `drizzle/0007_warehouses.sql`, generated snapshot/journal: additive warehouse
  table, singleton/FK/field constraints. No existing migration is changed.
- `src/app/(app)/settings/warehouse/`: page, form, action, loading/error states,
  action/UI tests. Settings adds the destination; existing workspace tests cover it
  for all seven roles.
- `.github/workflows/ci.yml`: adds the warehouse suite to the existing disposable
  PostgreSQL job. No new service or dependency.
- Build plan, database/API/testing docs, docs index, and this handoff record the
  delivery and next task. Pre-existing AGENTS/skills-lock/ECC installation changes
  are excluded from Task 17 commits.

Migration 0007 must be explicitly applied before the screen is used. Reverting
application code retains the additive table; corrections use a reviewed forward
migration. No seed or synthetic warehouse record is written to application storage.

## Design contract and rendered evidence

Screen question: “Which warehouse will this business use for purchases and
receipts?” The current name, optional location, and active status lead; one compact
settings form follows. The existing Settings/catalogue/supplier screens supply
local references. Retain ADR 0020's shell, system font, blue primary action,
semantic tokens, 44px controls, and Pashto/RTL support.

Applied find-skills, Ponytail full, Context7, product-lens, search-first,
frontend-patterns, frontend-design-direction, accessibility, postgres-patterns,
security-review, tdd-workflow, e2e-testing, verification-loop, deployment-patterns,
and both required design skills. Search-first's researcher confirmed the existing
house patterns fully cover this task; no dependency search/install was necessary.

Taste's app draw selected `achromatic-ledger`, seed `992623381`, retaining palette
and type. Its quiet settings treatment fits this singleton. ADR 0020's established
shell, blue actions, typography, radii and control sizes supersede conflicting
generic draw values; no replacement theme or shell is introduced. The business's
warehouse identity and active state give the screen its subject. UI/UX Pro Max's
focused UX/Next.js searches guided announced errors and Server Action feedback.

Ignored `artifacts/task17-warehouse/` contains actual-component HTML fixtures,
screenshots, local browser scripts/results, and evidence JSON. Fixtures use
synthetic warehouse/business data and mocked provider/action boundaries. They cover
wide/narrow LTR/RTL setup, empty/read-only/partial/inactive/long content, invalid,
pending/success/conflict/existing-record feedback, loading, and error recovery.
Synthetic rendering and hydrated mock-action checks do not establish live Clerk,
real translated-label usability, provider-backed database mutations, or deployment.

Taste source lint passes. Desktop app probes have no findings. At narrow widths,
the generic title-size warning is the accepted shared PageHeader's 30px title.
The 320px edge-text finding belongs to the existing intentionally scroll-clipped
compact navigation; warehouse page content reflows without horizontal overflow.
These are documented shared workspace constraints, not a new visual exception.

## Pre-validation review and test-first evidence

Reviewed the full Task 17 diff and connected callers with Ponytail Review:
Settings navigation, tenant/permission/provider guards, organization locking,
schema/SQL/snapshot, service/action/form/recovery, tests, CI, and documentation.
Assumed the existing small invited pilot with concurrent requests across processes.
Traced validation, parameter binding, cross-tenant IDs, provider changes, queued
grant revocation, singleton races, failed edits, stale status changes, safe errors,
refresh behavior, controlled inputs, keyboard use, RTL and read-only access.

Resolved a must-fix refresh finding: a key based on changing warehouse details remounted
the form after refresh and erased the “Saved.” confirmation. A hydrated page check
failed waiting for the confirmation after changed server props. Simply removing
the key preserved feedback but allowed drafts to carry into a different business;
a second hydrated page check reproduced that case. The final form key is the
server-verified organization ID: stable within a business, different on business
switching. Both browser regressions pass. The ID is used for React identity, not
accepted as mutation authority. A reload refreshes form values from storage.
No unresolved must-fix finding remains in Task 17.

RED checkpoint `419a708` records missing warehouse service/action/page implementation
referenced by all four new test suites. The targeted Vitest run failed for those
missing feature modules before production edits. GREEN is the same focused suites
after implementation, plus PostgreSQL and hydrated browser acceptance below.
The Drizzle SQL test assertion was corrected to allow the bound query-limit value;
it still verifies tenant and active filters. No coverage tooling is installed;
no coverage percentage or live E2E result is claimed.

## Verification

- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`: pass after
  the final reviewed form-identity change. Full database-free run: **566 passed**,
  **75 opt-in database tests skipped**. Production build includes dynamic
  `/settings/warehouse`.
- All six isolated PostgreSQL suites: **75 passed**, including **12 warehouse
  cases**. The warehouse suite passed again after the final workspace DTO change.
  Clerk identities are mocked. Migration 0007 applied/reapplied on
  `afcs_task07_verify` and `afcs_dev`: eight ledger rows each; prior migration
  hashes/timestamps unchanged. Fixtures clean up their own warehouse/grant/business
  rows. No synthetic warehouse data is seeded into the development database.
- **96** synthetic layout/label/control checks pass at 1440x900, 390x844, and
  320x844 in LTR/RTL. **12** hydrated checks pass, including named submission,
  retained invalid values, focused/linked errors, keyboard interaction, cancelled
  and confirmed deactivation, pending controls, confirmation after server refresh,
  draft reset on business switching, reactivation identity, reduced motion, and
  absence of browser exceptions. These use the actual page/form with mocked
  action/data boundaries, not a live provider-backed application session.
- Taste source lint: **0 failures, 0 warnings**. Rendered probe dispositions are
  recorded above. Inherited core text/action token contrast is at least 4.5:1 on
  white. Visual review covers desktop, narrow RTL long text and inactive setup.
- `npm audit --omit=dev --audit-level=high`: **0 vulnerabilities**. No package changes.
- Design evidence checker passes. Markdown links/anchors: **425 links across 76
  files**, no errors. Feature whitespace checks pass. Security/diff review found
  no unresolved input, authority, tenant, transaction, or disclosure issue.

Remote PR checks/reviews are reported separately at delivery. Live Clerk,
provider-backed application mutations, translation usability, and deployment
smoke were not performed. Coverage tooling remains absent; no percentage claimed.

## Limitations and next task

Selection is not posting authorization. Purchases/receipts must recheck the active
tenant warehouse within their transaction and decide any historical snapshots in
their own tasks. Edits use last successful write semantics. There is no multi-site
support. Live provider/deployment acceptance and existing pilot release gates stay
open. Task 15's adjacent product/catalogue hidden-ID follow-up remains separate.

Next: **Task 18 — purchase order drafts**. Task 16 remains deferred under ADR 0003.
