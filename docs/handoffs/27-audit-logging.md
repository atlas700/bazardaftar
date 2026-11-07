# Task 27 — Append-only audit logging

Date: 7 November 2026. Acceptance and local verification complete; ready for PR review.
Source: [Task 27](../agent-sized-build-plan.md#27--add-append-only-audit-logging),
[ADR 0016](../adr/0016-local-business-authorization.md),
[ADR 0019](../adr/0019-pilot-numeric-settlement-policy.md).

The pilot needs to trace who changed a business record and correlate stock/debt
posting and approvals. This task appends bounded summary events alongside the
existing domain sources. It introduces no dependency, environment variable, public
API, audit screen, export, balance cache, financial policy or stock-policy change.

## Completed acceptance checks

- `audit_logs` records a generated UUID, verified local organization and actor
  user/membership, source entity type/ID, action, outcome, request/correlation UUID,
  UTC occurrence timestamp and safe before/after summaries. Tenant FK, supported
  metadata/outcome checks, JSON object/size checks and a scoped request index are
  included in reviewed migration `0016_append_only_audit.sql` and its generated
  snapshot/journal. UPDATE, DELETE and TRUNCATE fail through a statement trigger;
  no application mutation API can rewrite history.
- `appendAudit()` requires an explicit connection and verified actor. Local events
  use the mutation's transaction after current authority checks. Audit failure
  propagates and rolls back local business writes. Inputs never supply audit tenant,
  actor or authorization. The writer uses database `clock_timestamp()` so a provider
  completion cannot inherit the outer transaction's earlier start time.
- Coverage includes newly created local business settings/owner grants; staff role
  changes and invitation/add/revoke/deactivation calls; units/categories/products;
  supplier and warehouse create/edit/status; purchase create/edit/order/cancel;
  receipt acceptance and explicit owner variance approval; receipt payable and
  purchase reconciliation; owner stock adjustments; supplier payments and separate
  owner rounding reductions. Source IDs link operational details without replacing
  the inventory ledger, financial allocation records or approval reasons.
- Existing authorized financial/stock replays return before adding audit rows.
  All events in a posting use its existing UUID. Other operations receive a server
  UUID. Concurrent seeds record only returned new units. Existing local roles and
  provider no-ops do not create new change events. Bootstrap audits only inserts
  actually performed, preserving pre-existing grants and one-time owner markers.
- Snapshots allow only bounded operational scalars and approved changed-field
  names. Supplier personal names/contact details, locations, emails, provider display
  identifiers, free-text notes/reasons/references/terms, credentials/sessions and
  arbitrary nested values are excluded. Exact money/quantity strings stay strings.
  Catalogue/product/warehouse names are bounded existing business fields. These
  summaries do not reconstruct every historical purchase line or replay the domain.

## Staff provider boundary

Clerk does not participate in a PostgreSQL transaction. Staff first locks the
organization and validates current actor, target, permission and last-owner rules.
Immediately before a real remote call, it independently commits a `requested`
audit row. A storage failure prevents that call. After provider success, a
`completed` row commits in the local transaction with the same correlation UUID.
Invite completion retains the returned invitation ID; request evidence targets
the organization until that ID exists. Contact addresses are not copied to audit.

The organization lock is `FOR NO KEY UPDATE`. It still conflicts with every app
mutation's organization lock but permits the independent intent's tenant-FK check.
The existing concurrent last-owner and queued-revocation tests continue to pass.
See [PostgreSQL 16 row locks](https://www.postgresql.org/docs/16/explicit-locking.html#LOCKING-ROWS).

An unmatched request may reflect a failed/ambiguous provider response, interruption,
or remote success followed by audit/commit rollback. It never asserts completion.
The founder must reconcile tenant/action/target/time and UUID with Clerk before
retrying; a lost invitation response may require the protected invitation list.
No automatic reconciler, distributed rollback or direct-Clerk-Dashboard audit is
claimed. Local onboarding events cover successful local provisioning, not earlier
external organization creation. Live provider behavior remains unverified here.

## Access, retention and redaction

- Existing `audit.read` permits owner, admin and accountant. This task exposes no
  reader/route/browser payload; a future reader must recheck provider membership,
  local grant and tenant scope. Founder-controlled DB inspection remains operational
  access, not an authorization substitute for ordinary staff.
- Retain pilot audit records without automatic expiry. No purge/edit/delete path
  exists. Future archive/removal needs an approved retention/access procedure;
  30-day backups do not imply 30-day audit retention. Actor/source identifiers
  remain sensitive tenant data. Do not invent historical actors in a backfill.
- Trigger enforcement protects ordinary writes, not a database owner/superuser
  capable of disabling triggers or changing schema. Restricted runtime DB grants
  and separate migration authority remain Task 34 deployment work. See the
  [security contract](../security.md#business-audit-trail).

## Changed files and migration

- New `src/db/audit.ts`, writer tests, audit PostgreSQL integration suite and
  guarded `audit-fixtures.test-support.ts`; schema plus additive migration 0016.
- Explicit audit calls in onboarding, staff, catalogue, supplier, warehouse,
  purchasing, receiving, adjustment and supplier-settlement writers. The Clerk
  invitation adapter returns its created invitation ID; existing callers/tests
  account for that return value.
- Existing integration teardown calls a helper limited to tracked synthetic tenants
  in `afcs_task07_verify`. It exclusively locks audit storage, temporarily disables
  its guard and restores it in the same transaction. It has no application caller.
  Unit mocks now return the rows needed by audit snapshots; staff assertions
  distinguish audit writes from role grants.
- PostgreSQL CI includes the new audit suite. README, build plan, module map,
  database/API/security/testing guides and documentation index reflect the feature.

## Test-first evidence

| Guarantee | RED | GREEN |
| --- | --- | --- |
| Transactional writer and bounded redaction | `0fa69fd`: new writer import failed because the module did not exist | `29da65e`: five writer cases and typecheck passed |
| Atomic mutation and provider coverage | `600b0b3`: 14 of 17 integration cases failed because mutation events were absent | `b07c1c6`: all 25 expanded audit PostgreSQL cases passed, including source rollback |

Additional runtime regressions were observed before fixing: rejected/no-op provider
commands initially left intent rows; transaction-start timestamps put completion
before request; bootstrap initially claimed an owner promotion after a preserved
viewer-role conflict. The final cases require no misleading intent, correct clock
ordering and truthful returned-insert evidence.

## Pre-validation review and final verification

Applied Ponytail review to the complete task diff and connected auth, tenant/grant,
source-schema, mutation, retry, action and test callers, assuming the approved small
purchasing pilot. Checked actor provenance, organization serialization, remote/local
failure boundaries, source attribution, snapshots, SQL binding, immutable history,
test cleanup and schema/migration consistency. Two GPT-6 Luna researchers mapped
integration points; a separate focused GPT-6 Luna review found no concrete blocker.
The parent reviewed the same critical paths and documented the provider/DB-owner
limitations above. No unresolved must-fix findings remain.

Development regressions listed above were fixed and rechecked before this final
pass. An earlier combined DB run timed out after the old staff test waited for a
transaction while intent persistence waited for its held lock. The final design
records intent after validation under `NO KEY UPDATE`; the existing transaction
synchronization is restored. No timeout increase or weaker authority/lock assertion remains.
Only the failed run's 97 tracked-pattern synthetic organizations within its exact
isolated-DB timestamp window were cleaned; application records were not removed.

Final checks after review:

- `npm run build`, `npm run typecheck`, `npm run lint`: pass.
- `npm run test`: 59 files and 789 database-free tests pass; its 250 PostgreSQL
  cases are explicitly skipped without the isolated test URL.
- All 13 PostgreSQL suites from the CI file list, with `AFCS_TEST_DATABASE_URL`
  restricted to `afcs_task07_verify`: **250 tests pass**, including 25 audit cases.
  The targeted command is `npm run test -- src/db/audit.integration.test.ts` with
  the same [isolated setup](../database.md#onboarding-persistence-and-verification).
  Tests mock Clerk and create/clean only synthetic tenants.
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities.
- Migration 0016 applied twice to both local `afcs_task07_verify` and `afcs_dev`;
  each has 17 migration ledger entries, the new SQL hash matches and the audit
  guard remains enabled. Existing business rows are not backfilled or changed.
- `npm.cmd run db:generate -- --name=check_audit_schema`: no schema changes and
  no extra migration generated. `git diff --check` and focused security review pass.
- All 239 local Markdown links/anchors across the changed documents pass. No UI or browser fixtures were changed;
  this is backend behavior covered by service and PostgreSQL tests. Coverage
  percentages were not measured and no new coverage tooling was installed.

Remote CI/review status is tracked separately on the review PR. Local checks do not
establish live Clerk sign-in or mutations, provider outage reconciliation, translated
terminology, production DB privilege isolation, deployment, backups or recovery.

## Limits and next task

The audit trail begins with this migration and instrumented application operations.
It is not a general request/security-event logger, a historical backfill, full event
sourcing, an audit UI or a provider webhook feed. General logs and rate limits
remain Tasks 30–31. No frontend behavior changes require new visual fixtures.
Coverage percentages are not measured; no coverage dependency is added.

Next: **Task 28 — build the pilot dashboard**, using trusted purchase, receipt,
inventory and supplier queries. Customers/sales and extra reports remain deferred.
Live sign-in, Pashto terminology, outgoing-stock reconciliation, deployment,
backups/recovery and other pilot-release gates remain open.
