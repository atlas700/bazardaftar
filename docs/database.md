# Database

## Confirmed baseline

- PostgreSQL 16 and Drizzle with the `pg` driver provide the Task 07 foundation.
- `src/db/index.ts` exports a server-only, lazy pooled client. Development reloads
  reuse the pool; importing it does not connect, query, or apply migrations.
- `src/db/schema/index.ts` defines `organizations` (generated local UUID, unique
  Clerk organization ID, UTC creation timestamp), `organization_settings` (one
  business-settings row per local organization), and `organization_onboarding`
  (one durable request per creator, including the stable UUID and pinned remote ID).
  Task 10 adds the one-time `owner_membership_id` bootstrap marker and
  `organization_role_assignments` (local organization, verified membership/user,
  one fixed role, UTC creation timestamp). Its composite primary key, role/identity
  checks, and organization foreign key enforce grant invariants. Clerk owns
  membership; setup/grant records are not a membership mirror. See
  [ADR 0014](adr/0014-clerk-organizations-local-business-roles.md).
- `0000_baseline.sql` runs only `SELECT 1`; `0001_organizations.sql` adds the local
  mapping. `0002_organization_onboarding.sql` adds Task 09 settings and durable
  requests without modifying existing mapping rows or migration history.
  `0003_business_roles.sql` adds the grant table and nullable bootstrap marker;
  it does not backfill or infer business roles.
  `0004_catalog_units_categories.sql` adds organization-owned units and categories
  under the [Task 13 exception](adr/0003-helmand-pilot-workflow.md#amendment--task-13-implementation-before-g1-closure-28-october-2026).
  `0005_products.sql` adds products and same-tenant catalogue foreign keys under
  the [Task 14 exception](adr/0003-helmand-pilot-workflow.md#amendment--task-14-implementation-before-g1-closure-31-october-2026).
  `0006_suppliers.sql` adds tenant-owned supplier contact records under
  [ADR 0021](adr/0021-supplier-contact-records.md), after G1 acceptance. It contains
  no balance, payable, or payment fields.
  `0007_warehouses.sql` adds one warehouse per organization, including inactive
  records, under ADR 0003's pilot scope and ADR 0016's business-settings grants.
  `0008_purchase_drafts.sql` adds draft purchase orders/items with tenant foreign
  keys and durable weight/price snapshots. `0009_exact_purchase_line_check.sql`
  enforces exact half-up line totals using quotient/remainder arithmetic, avoiding
  intermediate division rounding near a half-cent boundary.
- `DATABASE_URL` is required by application startup and migration tooling. It is
  server-only and must never use a `NEXT_PUBLIC_` prefix.
- SQL and metadata live in `drizzle/`. Migrations are explicit operations, separate
  from application startup, builds, and CI's `quality` job. The separate disposable
  CI database job applies committed migrations under
  [ADR 0013's amendment](adr/0013-local-postgresql-foundation.md#amendment--disposable-ci-verification-28-october-2026).

## Local setup

Use Node.js 24 and a running PostgreSQL 16 server. On Windows, add
`C:\Program Files\PostgreSQL\16\bin` to your terminal's `PATH` if needed.
Install locked dependencies with `npm ci`.

Provision once with a PostgreSQL administrator, outside the application. Connect
with `psql -h 127.0.0.1 -U postgres -d postgres -W`, then run the following for
roles/databases that do not already exist:

```sql
CREATE ROLE afcs_dev LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
\password afcs_dev
CREATE DATABASE afcs_dev OWNER afcs_dev;
CREATE DATABASE afcs_task07_verify OWNER afcs_dev;
```

`\password` prompts without placing the password in SQL history. The application
role owns these local databases but cannot create databases, manage roles, or act
as superuser. Use administrative credentials only for provisioning. See
[PostgreSQL role options](https://www.postgresql.org/docs/16/sql-createrole.html).

Copy [`.env.example`](../.env.example) to the ignored root `.env.local` without
overwriting existing Clerk settings. Set `DATABASE_URL` to
`postgresql://afcs_dev:YOUR_ENCODED_PASSWORD@127.0.0.1:5432/afcs_dev`.
Percent-encode reserved password characters. Keep real credentials out of source
control and terminal output. Drizzle Kit uses `@next/env` to load the same root
environment files as Next.js; an existing process variable takes precedence.

## Generate, review, and apply migrations

For later approved schema changes:

```powershell
npm.cmd run db:generate -- --name=describe_the_change
git status --short drizzle
git diff -- drizzle
```

Read new SQL files as well as the tracked diff, review constraints and data-loss
risks, and commit SQL with its generated metadata. The initial empty-schema
baseline was generated once with
`npm.cmd run db:generate -- --custom --name=baseline` and filled with `SELECT 1;`.
Do not regenerate or edit it after application. Do not use `drizzle-kit push`.
Use `npm.cmd` when forwarding flags in Windows PowerShell; in other shells use
`npm`. This avoids the PowerShell `npm.ps1` wrapper consuming migration flags.

Verify reviewed migrations on a separate database before development. The retained
`afcs_task07_verify` receives the ninth and tenth migrations for Task 18. A fresh checkout may
instead use a newly provisioned empty database. In a
dedicated PowerShell terminal, set a process-only override without recording the
connection string in shell history:

```powershell
$env:DATABASE_URL = Read-Host 'Full PostgreSQL URL for afcs_task07_verify' -MaskInput
npm run db:migrate
npm run db:migrate
Remove-Item Env:DATABASE_URL
```

Both runs must succeed, with exactly ten migration rows in
`drizzle.__drizzle_migrations` and eleven public tables (the four foundation tables
plus `catalog_units`, `product_categories`, `products`, `suppliers`, `warehouses`,
`purchase_orders`, and `purchase_order_items`) plus the ledger.
Verify prior migration hashes remain unchanged. Run the isolated onboarding tests
below for uniqueness, concurrency, settings constraints, and rollback. Stop on any
failure. Removing
the override restores `.env.local` loading for the development command:

```powershell
npm run db:migrate
```

Use `psql -h 127.0.0.1 -U afcs_dev -d afcs_task07_verify -W` (or `-d afcs_dev`)
to inspect the target explicitly:

```sql
SELECT current_database(), current_user;
SELECT count(*) FROM drizzle.__drizzle_migrations;
SELECT schemaname, tablename FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema');
```

Task 08 left the mapping table empty; Task 09 writes it only through authenticated
onboarding. Reads never provision it. Later migrations increase the ledger count.
Commit generated history unchanged;
never rewrite an applied migration. See [Drizzle migration guidance](https://orm.drizzle.team/docs/migrations).

## Recovery

The baseline changes only the migration ledger. Reverting application code does
not undo database changes; leave the applied baseline intact. Correct later schema
mistakes with reviewed forward migrations. Destructive work needs an explicit
migration plan, a backup, and a restore procedure before application.

For local recovery planning, `pg_dump -Fc -h 127.0.0.1 -U afcs_dev -d afcs_dev -W -f <private-backup-path>`
creates a custom-format backup. Have an administrator provision a separate empty
recovery database owned by the application role, then use
`pg_restore --exit-on-error --no-owner -h 127.0.0.1 -U afcs_dev -d <recovery-database> -W <private-backup-path>`
and verify its data before considering a switch. Keep backups outside the repo.
See [PostgreSQL backup guidance](https://www.postgresql.org/docs/16/app-pgdump.html).
Amended [ADR 0018](adr/0018-managed-pilot-hosting.md) assigns production recovery
to the founder and sets 30-day retention, at most one hour of lost entries, and
four-hour recovery during business hours. Destination, configuration, and restore
evidence remain G4 work; these local commands do not establish production readiness.

## Tenant-context contract

`getTenantContext()` from `src/db/tenant.ts` is server-only, takes no client input,
and returns `Promise<{ userId: string; organizationId: string; membershipId: string }
| null>`. It first verifies the active Clerk membership through the auth adapter,
then selects only the matching local UUID using a parameterized query. Missing
membership or mapping returns `null`; database failures throw a sanitized error.
No writes, alternate-organization selection, or persistent membership cache occur.
Task 09 must provision local mappings idempotently after Clerk creation; remote
Clerk operations cannot participate in a PostgreSQL transaction. Keep local data
and history if the remote organization disappears. Business roles remain local
and require the separate Task 10 permission guard after membership verification.

## Onboarding persistence and verification

`src/db/onboarding.ts` reserves an immutable request with `user_id` as its primary
key. A generated unique UUID is the server-owned retry identity. A unique nullable
Clerk ID records verified remote success before local business writes; a
conditional update prevents replacing that pinned ID. Business details from the
first validated submission remain fixed across retries.

Local mapping/settings/first-owner writes share one transaction. Locking the saved
request serializes concurrent bootstrap attempts, including stale callers. The
first verified membership is recorded only with its grant; subsequent attempts
cannot restore a changed/deleted role or bootstrap a rejoined membership. Unique Clerk IDs and the
settings organization primary key arbitrate concurrent writes. Settings require a
valid organization foreign key, nonempty bounded names/types, `AFN`, and a supported
locale. Retries confirm existing values rather than overwriting them. No remote
call holds a database transaction or connection open. See the full
[recovery contract](api-conventions.md#implemented-onboarding-contract).

Run the opt-in tests only against the isolated verification database:

```powershell
$env:AFCS_TEST_DATABASE_URL = Read-Host 'Full PostgreSQL URL for afcs_task07_verify' -MaskInput
npm.cmd run test -- src/db/onboarding.integration.test.ts
Remove-Item Env:AFCS_TEST_DATABASE_URL
```

The suite checks `current_database()` before writes, uses unique synthetic fixtures,
and deletes only its grants/settings/mappings/requests afterward. Without the variable, its sixteen tests are
explicitly skipped; ordinary unit tests need no running database. CI's separate
`database` job starts PostgreSQL 16 with a fresh `afcs_task07_verify` database,
applies committed migrations twice, and runs all four integration suites with fixed
job-local credentials. The service is discarded when the job ends; no repository
secret or shared application database is used. After the
26 October local migration, concurrency/rollback tests, and browser smoke checks,
all three public tables are empty in both local databases.

On 27 October, Task 10 applied/reapplied the reviewed fourth migration on the
verification database and applied it to development. Both retained their three
prior migration hashes; the fourth hash matches the reviewed SQL. After the
extended tests, all four application tables are empty in both databases.

The extended suite verifies actual guard queries across organization, membership,
and user boundaries, role/foreign-key constraints, first-owner concurrency,
bootstrap rollback, and retry non-escalation. Existing Task 09 businesses must
explicitly resume their saved setup for the first owner grant after applying the
new migration. Reads never perform that upgrade; there is no bulk grant migration.
Keep bootstrap markers when changing/removing staff roles. Organizations without a
verifiable saved setup require a separately reviewed recovery procedure.

## Principles for future work

- Store money as PostgreSQL `numeric` or a documented integer minor-unit scheme;
  never as JavaScript floating point.
- Treat `inventory_movements` as the stock audit source when inventory is added.
- Scope future business data by organization and derive tenant context on the server.
- Execute receiving, sale fulfilment, and payment allocation atomically.
- Accepted receipt, inbound stock movements, supplier payable, and purchase status
  commit together. Derive supplier balances from receipt payables less supplier
  payment allocations; see [ADR 0012](adr/0012-receipt-supplier-payables.md).

## Accepted receipts, stock, and supplier payables

Task 20 adds migration `0011_accepted_receipts.sql` and four tables:

- `goods_receipts`: purchase/supplier/warehouse/currency, request UUID and SHA-256
  fingerprint, receipt total, final-delivery flag, accepting membership/user/time,
  and explicit owner variance approval/reason when required.
- `goods_receipt_items`: stable ordered-line/product references; entered quantity,
  measure name/kind and actual kg/bag; normalized kg; approved price/price-weight
  snapshots; previous/cumulative accepted kg and previous/new recognized debt.
- `inventory_movements`: one unique inbound `receipt` movement per receipt line,
  product, warehouse, positive gram-precise kg, performer identities and UTC time.
  This ledger is the stock source of truth; no stock balance field is overwritten.
- `supplier_payables`: one unique obligation per receipt, retaining its supplier,
  currency, exact total and UTC recognition time. Zero-value obligations are
  retained when free goods or cumulative rounding produce zero debt.

Purchase lines add bounded `received_quantity_kg`, `recognized_value`, and
`approved_extra_kg` reconciliation cursors. Exact quotient/remainder checks enforce
cumulative half-up value and quantities cannot exceed ordered plus approved extra.
These cursors serialize acceptance and do not replace receipt or movement history.
Composite tenant foreign keys bind receipts to their actual agreement, lines to
their receipt/purchase/product, movements to the exact receipt-line product/kg,
and payables to the receipt's exact supplier/currency/amount. Receipt request,
movement source and payable source are unique within the organization.

The service takes the shared organization and purchase/line row locks, rechecks
current membership/permission and active references, then commits every posting
and purchase revision/status together. Ordinary partial deliveries remain open;
excess and final short deliveries require explicit accepting-owner approval under
ADRs 0006/0016. Receipt UUIDs are full human-visible references and idempotent
replays survive later receipts. Purchase detail reads its agreement, cumulative
state and receipt history in the same repeatable-read transaction. Small pilot
history is read in full; paginate before substantial history.

Apply migration 0011 before this application revision. New tables/default-zero
cursors preserve existing purchases; the migration orders referenced unique
constraints before new foreign keys. Do not edit prior migration history. Retain
receipt-aware reads and disable acceptance if rolling back application code;
older lifecycle code cannot accurately display new receipt states. Never delete
posted movements or payables as an application rollback.

Run `src/db/receipts.integration.test.ts` on the existing isolated verification
database. CI includes it in the disposable PostgreSQL job. The
[handoff](handoffs/20-accepted-receipts.md) distinguishes local migration, test and
synthetic browser evidence from live provider/deployment acceptance. Task 21 owns
inventory balance/history read models; Tasks 25–26 own payments and statements.

## Staff management

Task 11 adds no tables or migrations. Its staff mutations lock the existing
`organizations` row with `FOR UPDATE`, then read fresh assignments and provider
memberships. Role upserts use the composite organization/membership key and exact
verified user identity. Remote deactivation retains the original assignment;
current Clerk membership remains mandatory for every authorization lookup.
Clerk mutations cannot roll back with PostgreSQL; see
[staff recovery](handoffs/11-staff-management.md#expiry-and-recovery).

`src/db/staff.integration.test.ts` uses the same opt-in isolated database command
as onboarding. It verifies competing owner demotions/removals, a queued actor's
revoked role, cross-tenant targets, stale sessions, removal/rejoin, and failed
remote removal. It refuses other database names and cleans up its synthetic rows.

## Decision status

**Decided — G3 numeric and settlement policy:**
[ADR 0019](adr/0019-pilot-numeric-settlement-policy.md) resolves Task 12's numeric
prerequisite. Use kg with one-gram precision, business-owned custom weight
measures, two-decimal unit prices, exact conversions, two-decimal half-up purchase
lines, and summed rounded purchase totals. Recognize each receipt line as its
rounded cumulative accepted value less previously recognized value.

Preserve original measure, bag-size, price-basis, currency, and exchange-rate
snapshots. AFN/PKR payable balances remain separate; whole-cash payments may mix
currencies at a supplier-agreed PKR-per-AFN rate with at most six decimals.
Convert the combined amount exactly and round once for allocation in the debt's
currency. Append owner-approved cash rounding reductions separately, with
provenance and a lifetime cumulative cap of 0.99 in that currency. Serialize
allocation/cap checks and writes, preserving idempotency and original debt/cash.
Task 13 implements the custom-weight catalogue described below. Exchange,
adjustment, and transaction-line snapshot persistence remain in later tasks.

**Decided — G3 product identity:** each product is one stock identity for the
pilot; see [ADR 0005](adr/0005-product-stock-identity.md). Grade, origin,
harvest-date, and quality distinctions remain deferred unless G1 establishes that
an attribute creates operationally distinct stock for purchasing, storage, or
pricing.

**Decided — G3 receiving:** a receipt variance requires wholesaler-owner approval;
see [ADR 0006](adr/0006-receipt-variance-approval.md). The approver remains the
owner unless G1 establishes that the owner is unavailable for routine receipts.

**Decided — G3 stock policy:** no transaction or authorized correction may result
in negative stock; see [ADR 0007](adr/0007-no-negative-stock.md). A would-be
negative quantity must be rejected while its underlying receipt or count discrepancy
is investigated and corrected.

**Decided — G3 sale timing:** reduce stock at dispatch only if G1 establishes that
physical handoff is reliably recorded; see
[ADR 0008](adr/0008-dispatch-stock-timing.md). Otherwise, revisit sale timing before
the stock-decreasing sales workflow is implemented.

**Decided — G3 credit allocation:** record one supplier payment and explicit
oldest-first allocations to its unpaid receipt payables in the same organization
and debt currency, under amended
[ADR 0009](adr/0009-specific-obligation-payment-allocation.md). One payment can
cover several payables; its allocation rows must sum to the single rounded
converted cash value. Derive supplier balances from the payables, allocations,
and payable-specific owner reductions. Reject overpayments and unapplied credit;
serialize supplier-total, per-payable, and lifetime-cap checks with all writes.
Task 26 must count payment cash once regardless of allocation-row count. These
are future schema/service requirements; no payment tables are implemented yet.

**Decided — G3 correction authority:** stock corrections and transaction
cancellations require wholesaler-owner approval; any future return requires the
same approval and a separate scope decision. See
[ADR 0010](adr/0010-owner-approval-for-corrections.md).

**Decided — G4 database foundation (21 October 2026):** the founder approved local
PostgreSQL 16, Drizzle with `pg`, the structural ownership model, and explicitly
reviewed/run migrations with forward-fix and backup/restore recovery. See
[ADR 0013](adr/0013-local-postgresql-foundation.md). Detailed business schema and
screens after Task 14 require task-specific acceptance checks. G1 was accepted on
retrospective founder evidence on 1 November under ADR 0003; Tasks 13 and 14 had
separate limited pre-research exceptions. ADR 0019 resolves the
numeric policy; other G4 readiness gates remain open. Current eligibility is recorded in the
[build plan's gate status](agent-sized-build-plan.md#current-gate-status).

## Units and product categories

Task 13 adds `catalog_units` and `product_categories`, each with a generated UUID,
an organization foreign key, a bounded trimmed name, and an active flag. Names
are unique per organization and table, ignoring case and outer spaces; inactive
names remain reserved. No row is deleted or automatically reactivated.

Fixed units have a positive kg weight with at most 18 integer and three fractional
digits. Bag units have no catalogue weight; each future transaction line supplies
its actual weight. The unscaled PostgreSQL `numeric` column uses CHECK constraints
for precision/range, rejecting sub-gram input instead of rounding on storage.
The service normalizes accepted weights to three decimal places using Task 12.

Reads require `catalog.read`; mutations require `catalog.manage`. Mutations share
staff's organization row lock and recheck current Clerk membership and the exact
membership/user-bound grant within the lock. Database reads during that recheck
use the transaction connection, including under more than ten concurrent requests.
Creates, edits, and deactivation use server-derived organization scope. The
explicit default-unit action adds kg, maan, khorwar, and variable-weight bags
idempotently, retaining existing definitions and deactivation. Categories start
empty. Reads never seed data.

`getUnitSnapshot` reads only a current active unit in the caller's organization.
It returns scalar copies of unit ID, name, kind, entered quantity, kg weight, and
normalized stock kg. It requires an actual bag weight and rejects a weight override
for fixed units. Fractional quantities requiring sub-gram stock are rejected.
Later posting services must store these values inside their transaction and apply
their own positive-quantity/permission rules; this task adds no purchase/receipt
tables. Measure edits/deactivation do not mutate previously returned snapshots.

Run `src/db/catalog.integration.test.ts` with the same isolated verification URL
as onboarding. It verifies permissions for every role, tenant isolation, duplicate
names, deactivation, custom/local/fractional weights, bags, snapshots, database
constraints, concurrent seeding, and queued actor revocation. CI includes it in
the disposable database job. The suite refuses other database names and removes
only its synthetic records. Apply the reviewed fifth migration to verification
before running the suite, and apply/reapply it to development before using the page.

## Products

Task 14 adds `products`: a generated UUID, organization, trimmed 1–80 character
name, optional trimmed 1–40 character code/SKU, optional category, required weight
unit, and active flag. Names and non-null codes are unique per organization,
ignoring case and outer spaces, including inactive products. Blank optional codes
are normalized to null. No product is deleted or reactivated.

Composite foreign keys enforce that a product's unit and category belong to its
organization, including for direct SQL writes. The migration adds the referenced
unique constraints before creating those foreign keys. Product creates/edits
require active references; an existing inactive reference must be replaced (or an
optional category cleared) when editing. Deactivation remains possible regardless
of reference status. Existing products remain readable when references deactivate.

The catalogue service reuses `catalog.read`, `catalog.manage`, organization
locking, and fresh membership/grant rechecks. `/products` and `/products/[id]`
provide create/list/detail/edit/deactivate screens, linked from Settings. Reads
include inactive products for history; future purchasing services must explicitly
check active product/unit state and persist transaction snapshots. The chosen unit
is an entry measure; stock still normalizes to kg under ADR 0019.

Apply/reapply reviewed migration 0005 before using products. Run
`src/db/products.integration.test.ts` with the same isolated verification URL as
the existing suites. It tests all roles, tenant denial, references, uniqueness,
concurrent creation, rollback, deactivation, and queued revocation. Default prices,
inventory, and grade/origin/lot attributes are deferred. Task 14's exception did
not close G1; the separate 1 November founder decision now records G1 acceptance.

## Suppliers

Task 15 adds `suppliers`: generated UUID, organization, name, optional phone,
location, Individual/Business type, notes, descriptive payment terms, and active
state under [ADR 0021](adr/0021-supplier-contact-records.md). Database constraints
mirror field bounds and the type vocabulary. Display names are unique within a
business, including inactive rows; phone contacts are not unique or credentials.
No mutable balance, payment, payable, or automatic due-date field is stored.

`src/db/suppliers.ts` enforces existing read/manage permissions, parameterized
tenant scoping, the shared organization lock, and fresh membership/grant checks.
Deactivation preserves readable records. Future purchasing must validate active
suppliers within its own transaction. Apply/reapply reviewed migration 0006 before
using the directory. Run `src/db/suppliers.integration.test.ts` with the same
isolated verification URL as the other suites; CI includes all six suites.

## Warehouse setup

Task 17 adds `warehouses`: generated stable UUID, organization foreign key,
trimmed name (1–80 characters), optional trimmed location (1–200 characters or
null), and an active flag defaulting to true. A unique organization constraint
includes inactive rows, so deactivation cannot create a second warehouse or
switch locations. No stock quantity is stored. The inactive record can be edited
and explicitly reactivated with the same identity; no deletion is exposed.

`src/db/warehouses.ts` uses `organization.read` for setup/active selection and
`organization.manage` for owner/admin writes under ADR 0016. Mutations share the
staff organization lock, then recheck current provider identity and local grants
on the transaction connection. `/settings/warehouse` is linked from Settings.
`getActiveWarehouse()` returns null before setup or when inactive; it supports
selection only. Future purchases/receipts must enforce their own permissions and
validate active warehouse ownership within their write transaction.

Apply/reapply reviewed migration 0007 before using the screen. The isolated
`src/db/warehouses.integration.test.ts` suite covers all seven roles, concurrent
singleton creation, cross-tenant denial, constraints, failed-edit preservation, deactivation,
reactivation, selection, and queued revocation. CI adds it to the existing job.

## Purchase drafts

Task 18 adds `purchase_orders` and `purchase_order_items`. Each order owns its
currency, draft status, server total, supplier/warehouse identity and name
snapshots, request UUID/fingerprint, actor membership/user, and UTC creation time.
Each numbered line retains product name/code, entered quantity and measure,
actual bag/fixed measure kg, normalized total kg, agreed unit price and separate
price measure/kg, and rounded line total. Catalogue/contact changes do not rewrite
these historical values. No stock or supplier debt is stored or posted.

Composite tenant foreign keys protect supplier/warehouse/product/unit/order
references. Unique `(organization_id, request_id)` and the shared organization
lock serialize retries; same normalized contents return the saved ID, different
contents conflict. Header/items commit together. CHECK constraints bound exact
unscaled numerics, positive weights/quantities, two-place non-negative money,
supported currency, and server-owned draft state. Header totals are computed
from validated rounded lines in the service transaction. The line constraint uses
`div`/`mod` half-up arithmetic; ordinary numeric division can round an intermediate
ratio near a half-cent at the supported bounds. Migration 0009 fixes that check
without rewriting the already-applied 0008 migration.

Apply migrations 0008–0010 before using the current `/purchases` workflow. Corrections use forward
migrations; reverting application code retains these additive tables. Task 20
rechecks posting authority/references and reconciles receipt
quantities/values independently. The pilot register currently loads its small
history in full; paginate before a large trading history.

Run `src/db/purchases.integration.test.ts` with the same isolated verification URL
as the other suites. It covers actual rollback, constraints, exact rounding,
snapshots, all roles, tenant isolation, inactive references, concurrent idempotent
retries, changed provider identity, and queued role revocation. CI includes it in
the existing disposable PostgreSQL job; no live Clerk calls are made.

### Purchase lifecycle

Migration `0010_purchase_lifecycle.sql` expands the status check to `draft`,
`ordered`, and `cancelled`, and adds a positive revision, update identity/time,
last mutation UUID/fingerprint, ordering identity/time, and cancellation
identity/time/reason. Metadata checks reject incomplete approvals. Existing
drafts start at revision 1; their creation request ID/fingerprint stays immutable.
The migration preserves existing rows and prior migration history.

Under the same organization lock and fresh provider/role checks, Task 19 edits
drafts atomically, orders drafts, and permits only an owner to cancel an unreceived
draft/ordered purchase. Draft line replacement keeps surviving line IDs and
reference names/weights for unchanged selections; new selections take current
catalogue values. Active references are rechecked for edits/ordering; cancellation
preserves history even when references are inactive. Ordered/cancelled lines are
never edited or removed. No stock/payable writes exist yet.

Each mutation includes the displayed revision. A changed revision conflicts
before any write. The most recent identical normalized request replays as success;
changed contents conflict. After a later mutation, old revisions conflict safely.
Header, lines, metadata and revision commit together. Detail reads use one
repeatable-read snapshot so an edit cannot mix a new header with old lines.
Task 27's audit write integration point is explicit on the mutation transaction;
order/cancellation provenance is already durable.
