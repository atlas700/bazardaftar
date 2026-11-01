# Task 15 — Suppliers

Date: 1 November 2026. Branch: `feat/15-suppliers`.
Implementation and local acceptance complete; ready for GitHub review.

## Authorization and completed acceptance

The founder requested Feature 15 and confirmed Individual/Business supplier types.
G1 was already accepted under ADR 0003's 1 November amendment. [ADR 0021](../adr/0021-supplier-contact-records.md)
records the contact policy; existing sign-in, terminology, deployment, and restore
gates remain open.

- Tenant-owned supplier UUIDs, required names, optional phone/location/type/notes/
  payment terms, and active state are implemented. Names are unique per business
  ignoring case and outer spaces, including inactive rows. Same-name contacts
  need distinguishing display names. Blank optional text becomes null.
- Types are `individual` / `business`, with an unspecified option. Phone supports
  Western, Arabic, and Persian digits and contact punctuation. It is not unique,
  verified, or an authentication credential. Payment terms are descriptive text.
- `/suppliers` provides directory/create; `/suppliers/[id]` provides detail/edit/
  confirmed deactivation. Navigation and Settings respect `suppliers.read`.
  Owner/admin/manager can manage; warehouse/accountant/viewer have read access;
  sales has neither under existing ADR 0016. Inactive records remain readable.
- Server authority comes from verified membership and local grants. Mutations
  share staff's organization lock, then recheck provider identity and the grant
  on the transaction connection. Client tenant/role/balance fields are ignored.
  Foreign or inactive updates conflict; foreign detail reads return not-found.
- The UI reuses ADR 0020's system fonts, semantic tokens, shared Button/Input/
  Field/Panel/status/recovery controls, Lucide, and the existing Radix Select/Slot
  primitives. Forms retain values, disable pending controls, announce outcomes,
  link inline errors to a focused summary, and confirm deactivation.
- No mutable supplier balance, purchasing, payable, payment, opening debt,
  calculated due date, enforced credit policy, or currency default is introduced.

## Changed files and migration impact

- `src/db/schema/index.ts`, `src/db/suppliers.ts`, and `src/domain/supplier.ts`:
  supplier storage, contact validation, reads, locked mutations, and type vocabulary.
- `drizzle/0006_suppliers.sql`, its generated snapshot, and migration journal:
  additive table, organization foreign key, unique display names, and checks for
  lengths, phone contacts, and types. No prior migration is changed.
- `src/app/(app)/suppliers/`: list/detail/forms/actions, loading/error/not-found
  states, action tests, and UI tests. Navigation/Settings and their tests include
  permitted supplier entry. Navigation's existing 10px future-work labels become
  11px following the design check.
- Supplier service and PostgreSQL test files; the existing CI database job adds
  the supplier suite. Database/API/testing/build-plan/ADR/index docs are updated.
- No dependency, environment-variable, provider, or deployment-resource changes.
  Pre-existing `AGENTS.md`, `skills-lock.json`, and untracked ECC installation
  changes are excluded from the feature commits.

## Design evidence

Applied `find-skills`, Ponytail full, Context7, product-lens, search-first,
frontend-patterns, frontend-design-direction, accessibility, postgres-patterns,
security-review, tdd-workflow, verification-loop, deployment-patterns, and both
required design skills.

Taste's app draw chose **framed-sheet**, seed **406712446**, keeping the accepted
palette and type; no redraw. ADR 0020's existing shell, blue actions, control
sizes, and heading scale take priority over generic sheet suggestions. The screen
answers “Who do we buy from, and how do we contact them?” with a directory first,
paired contact/location rows, quiet status, and one add action. Details answer
“What contact and payment agreement do we have?” without financial totals.
UI/UX Pro Max's focused UX/Next.js searches guided labels, errors, focus, and
Server Actions. No replacement design system or visual dependency was added.

Local artifacts are under ignored `artifacts/task15-suppliers/`: 30 synthetic
HTML fixtures, 90 screenshots/layout results at 1440x900, 390x844, and 320x844 in
LTR/RTL, a hydrated RTL form, control results, and the design evidence JSON.
Synthetic supplier names, phone contacts, and agreements exist only in fixtures.
No sample supplier data is seeded into application storage.

Taste source lint passes with app rules. Its browser probes/judges were run through
the existing local headless browser on file URLs. Desktop has no findings. The
remaining generic checks are explicitly scoped: `edge-text` at 320px sees the
intentionally scroll-clipped compact navigation, while page content has no
horizontal overflow; `app-title-size` prefers smaller mobile titles than the
accepted shared 30px PageHeader. These preserve the existing workspace contract.
Visual inspection covers directory/detail, narrow RTL, long content, errors,
empty/partial/inactive/read-only/pending/success states, and reduced motion.

## Pre-validation review and test-first evidence

Used `ponytail:ponytail-review` on the complete task diff and connected callers:
membership/tenant/permission guards, staff locking, schema/migration, service/action
boundaries, UI, navigation, tests, CI, and documentation. Assumed a small invited
pilot with concurrent requests across processes. Traced field validation, SQL
parameters, actor revocation, rollback, active-state changes, safe errors, cache
refresh, translations, retained values, keyboard use, and read-only controls.

Resolved and rechecked these findings before the final validation:

1. The installed Next.js 16.4 error boundary uses `retry`, rather than the older
   `unstable_retry`. A failing recovery-wiring test now passes with the stable prop.
2. A hidden control named `id` shadows the browser's `form.id`. React then gives
   its temporary submitter input the wrong form owner and drops `operation` from
   FormData. The hydrated save check demonstrated the failure. The supplier form
   now uses `supplierId`; the action maps it to the validated command's `id`.
   UI/action regressions fail before the fix and pass afterward. Hydrated checks
   confirm both save and confirmed deactivation carry the correct operation/ID.
3. Taste found the connected navigation's existing 10px labels. Raised them to
   11px and repeated navigation tests and rendered checks.

No unresolved must-fix findings in Task 15. The similar `id` naming in adjacent
product/catalogue forms predates this task and was not changed; their full live
form behavior needs a separate follow-up. The directory reads the small pilot in
full and edits use last successful write semantics.

RED checkpoints are `c5780ef` (new service/action/UI cases, missing feature modules,
and failing retry wiring) and `3ce8e8b` (13 PostgreSQL cases fail before migration
0006). GREEN evidence is the focused/full runs below plus hydrated form checks;
the final feature commit contains implementation and regression fixes.
No coverage tooling is installed; no coverage percentage or live E2E result is claimed.

## Verification

- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`: pass.
  Full database-free suite: **534 passed**, **63 opt-in database tests skipped**.
  The final production build includes dynamic `/suppliers` and `/suppliers/[id]`.
- All five isolated PostgreSQL suites: **63 passed**, including **13 supplier
  tests**. Clerk is mocked. Migration 0006 applied/reapplied on
  `afcs_task07_verify` and `afcs_dev`; each has seven ledger rows and unchanged
  prior hashes/timestamps. Initial RED-run fixtures were explicitly cleaned;
  retained `task15_org_` organizations: **0**.
- **90** synthetic layout checks and **10** hydrated form/control checks pass:
  RTL trigger/portal, 44px options, keyboard selection/focus return, selected
  FormData type, retained invalid input, focused/linked error summary, cancelled
  versus confirmed deactivation, and reduced-motion loading behavior.
- Taste app source lint: **0 failures, 0 warnings**. Rendered probe findings and
  justified workspace-contract dispositions are recorded above.
- `npm audit --omit=dev --audit-level=high`: **0 vulnerabilities**. No package changes.
- Design evidence record validation: pass. Local Markdown link/anchor validation:
  **420 links across 75 files**, no errors. `git diff --cached --check`: pass.

Remote PR checks/reviews are reported separately at delivery. Synthetic rendering
and mocked-provider database tests do not establish live Clerk sessions, real
translated-label usability, deployed routes, or provider-backed browser mutations.

## Limitations and next task

Directory pagination, reactivation, enforced payment terms, balances, purchasing,
payables/payments, and live provider/deployment acceptance are deferred. Future
posting must check active supplier ownership inside its transaction. Reverting
application code does not undo migration 0006; retain the additive table and use
a reviewed forward migration for corrections.

Next: **Task 17 — one warehouse**. Task 16 customers remains deferred under ADR 0003.
