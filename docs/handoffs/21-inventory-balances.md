# Task 21 — Inventory balances and stock history

Date: 5 November 2026. Branch: `feat/21-inventory-balances`.
Implementation and local acceptance complete; ready for GitHub review.

## Authorization and scope

The founder requested Task 21 after the next-feature assessment. Task 20 is
merged as PR #40, with its quality/database CI checks successful. This task
follows ADRs 0003/0016/0019/0020, retains the accepted retrospective G1 basis, and
leaves Task 16 and the real outgoing-stock/sign-in/terminology/deployment gates
in their existing states.

As an authorized stock reader, see recorded kg per product/warehouse, choose a
product's history, browse older movements, and inspect a receipt's original
quantity/measure/weight. Owners/admins/managers/warehouse/sales/accountants/viewers
retain the existing `inventory.read` grant. Purchase links/IDs require
`purchases.read`; sales receive stock information without purchase prices,
supplier details or purchase identifiers.

## Completed behavior and changed files

- `src/db/inventory.ts` derives tenant/actor authority from the existing verified
  guard, validates product/cursor UUIDs, and rechecks the membership/user's local
  grant on a read-only repeatable-read connection. Every resource lookup and join
  is tenant scoped. Malformed, missing and foreign references share unavailable
  recovery; unexpected failures expose only safe inventory error text.
- Available recorded stock is the exact PostgreSQL numeric sum of signed
  `inventory_movements.quantity_kg`, grouped by organization/product/warehouse.
  Current ledger rules permit inbound receipts only. Drafts/orders do not reserve
  or change stock. Products without movements have no balance row; inactive
  products/warehouses retain their recorded stock. Aggregate decimals are strings
  and can exceed an individual entry's bound. Different bag weights are never
  added as equivalent bag counts.
- History uses receipt-line product/measure snapshots and agreement warehouse
  names; balances use current names with inactive labels. Pages contain at most
  20 rows plus one lookahead and seek by `(created_at DESC NULLS LAST, id DESC
  NULLS LAST)`. The last visible UUID resolves a tenant/product-owned timestamp
  as PostgreSQL text, preserving microseconds. Balances cover the full selected
  scope independently of history position. Latest returns to the newest page.
- `src/app/(app)/inventory/` replaces the placeholder with exact balances,
  product-scoped history, full receipt UUIDs, permitted purchase links, older/
  latest/all-product navigation, and deliberate empty/loading/error/unavailable
  states. It states that outgoing stock is not recorded and physical counts must
  be reconciled. No stock-on-hand verification or valuation is claimed.
- The existing navigation marks inventory available. Receipt success invalidates
  `/inventory` as well as purchase routes. The existing exact display/quantity
  trimming helpers move to `src/components/exact-number.tsx`; purchase exports
  remain compatible. No new dependency, permission or mutation is introduced.
- `src/db/schema/index.ts`, generated migration `0012_inventory_read_indexes.sql`
  and its snapshot/journal add only the tenant/time/ID and tenant/product/time/ID
  movement indexes for these queries. Sort null handling matches the indexes.
  CI's existing isolated database job adds the inventory suite. README, build
  plan, docs index, database/API/testing guides describe the delivered scope.

The pilot balance list stays small and loads in full, with an explicit shortcut
comment. Movement history is paginated. No materialized/derived balance table or
balance cache is needed; profile representative large workloads before adding
one. Large-load latency and production query plans are not claimed.

## Test-first evidence

- `43a7f21`: service specifications import the absent inventory module; the
  intended missing-module RED is captured before implementation. `2fdec3f`
  implements the read boundary and indexes; 11 service cases and the initial
  14 isolated PostgreSQL cases pass.
- `a1f4b30`: eight screen cases execute and fail against the old placeholder.
  The implemented screen plus expanded recovery/quantity cases pass.
- `9ff38fe`: the existing receipt action's success test fails because inventory
  is not invalidated. `826304e` supplies invalidation and the screen integration;
  all 70 focused service/screen/navigation/purchase/action/guard checks pass.
- The expanded PostgreSQL inventory suite has 15 cases: mixed 44/48.4 kg bags
  plus grams, a total beyond the per-line bound, inactive/name snapshots, all
  seven roles, foreign tenant/product/cursor denial, empty/unavailable access,
  provider identity mismatch/revoked grants, and 24 timestamp-tied movements
  paginated 20/4 without duplicate/missing rows. Balances remain identical across
  pages. Existing purchase/receipt behavior remains covered by its suites.

Coverage tooling/full provider E2E remains outside the baseline; no coverage
percentage or live-provider evidence is claimed.

## Pre-validation review and design evidence

Ponytail Review covered the complete feature diff and connected permission/
tenant guards, receipt posting/actions, purchase formatter callers, schema and
generated SQL, UI/navigation and tests. Assumed the small invited pilot with
concurrent receipt writers. Reviewed query binding, exact numeric boundaries,
read snapshot consistency, cursor ties/foreign anchors, role-specific output,
safe errors, inactive references, locale/RTL and keyboard recovery.

Resolved findings: long unbroken names and very large quantities could overlap
inside narrow rows without overflowing the page; mobile rows now stack and text
wraps within its actual bounds. Receipt posting initially omitted inventory
invalidation; a failing action test now passes. Cursor timestamps retain database
microseconds and query null ordering matches the added indexes. The no-product
return explicitly preserves null in the public type. Rechecked the affected paths;
no unresolved task-specific must-fix finding remains.

Applied project-local find-skills, product-lens, inline search-first reuse review,
frontend patterns/direction, accessibility, PostgreSQL/security/test-first/E2E,
deployment and verification skills; Ponytail full/review; Context7 and installed
Next.js guides; Taste and UI/UX Pro Max. Existing services, exact formatting,
workspace panels/buttons/feedback and native links cover the task without an
additional package or agent. Context7 informs async page search parameters,
Drizzle aggregate/cursor queries and Server Action invalidation.

Taste direction: `achromatic-ledger`, seed `1399326080`, existing palette/type
retained. ADR 0020 governs the shared shell and controls. The screen's question
is how much stock is recorded and which receipts explain it; bag weight evidence
beside normalized kg is its domain-specific detail. UI/UX's focused search
informed empty-state recovery and accessible navigation. No illustrations/charts
or sample business records are added to the application.

Ignored `artifacts/task21-inventory/` holds actual-component synthetic fixtures,
screenshots, headless checks, design evidence and Taste inspection. Ten states
in LTR/RTL at 1440x900, 390x844 and 320x844 pass **60** checks for page overflow,
actual main text bounds, touch targets, named sections and isolated tabular
numbers. **5** additional checks cover scoped older/latest links, keyboard focus,
reduced motion and sales purchase-link denial. Desktop and narrow RTL captures
were inspected after correcting the overlap; the evidence-record checker passes.
Fixtures mock provider identities, translations and data; these are not live
Clerk or real translated-language acceptance checks.

Taste source lint: **0 failures, 0 warnings**. The complete-shell inspector
initially flags the existing 320px scrolling navigation edge text, the shared
30px mobile title and independent list panels ending at different heights.
Documented allowances: `edge-text` is unchanged shell scroll navigation;
`app-title-size` follows ADR 0020's shared heading; `ragged-row` is two independent
lists retaining their natural lengths. With only those allowances inspection
reports 0 failures/warnings. Main-content bounds, controls and contrast are
checked separately; this does not claim a clean unqualified shell audit.

## Verification and remaining limits

- After pre-validation review, `npm run build`, `npm run typecheck`,
  `npm run lint` and `npm run test` pass. The production build includes dynamic
  `/inventory`. Default tests report **672 passed, 165 opt-in database tests
  skipped**, across 50 passing and nine skipped files.
- The separate isolated PostgreSQL command passes all **165 tests across nine
  suites**, including all **15 inventory cases** and existing purchase/receipt
  regressions. It runs on `afcs_task07_verify`, checks its name before writes,
  creates synthetic organizations and removes only those fixtures afterward.
  It runs separately from the production build to avoid known resource contention.
- Migration 0012 applies/reapplies on local verification and development databases;
  each retains prior ledger entries and now has 13 migrations. Generation reports
  no schema drift. Previous migration files remain unchanged; no development
  business fixtures are added. Rollback can retain the additive indexes and all
  existing receipt/stock/payable rows.
- `npm audit --omit=dev --audit-level=high` reports **0 vulnerabilities**.
  Focused security review finds no floating-point quantity conversion, raw SQL
  concatenation, client authority, unsafe HTML or sensitive error logging in the
  new read/display paths. Whitespace and local documentation link checks pass.
- Local dependency restoration with `npm ci --ignore-scripts` repairs pre-existing
  missing module/declaration files in installed packages. Package/lock versions
  are unchanged. No declaration shim or weakened quality setting is introduced.
- Remote CI and live provider/deployment evidence remain separate. CI includes
  the inventory suite; this handoff records the completed local validation only.

Live Clerk/provider-backed navigation, Pashto terminology usability and deployed
routes remain unverified. Full end-to-end infrastructure remains Task 33. Stock
corrections, transfers, valuation, payments and statements are later work. The
physical closing-stock/outgoing reconciliation gate remains open.

Next: **Task 22 — controlled inventory adjustments**. The 5 November Task 22
assessment found its negative-stock prerequisite already settled by accepted
ADR 0007; the previous unresolved note was stale. Retain owner-only correction authority,
and deliberately extend movement kinds/source constraints and history provenance.
Do not edit/delete posted ledger rows or turn correction entry into an unapproved
sales/dispatch workflow. Task 16 remains deferred.
