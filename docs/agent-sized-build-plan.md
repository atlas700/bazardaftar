# Agent-Sized Build Plan — BazarDaftar

## Purpose

This turns the product vision into small, resumable work packages. A single coding
agent should complete **one numbered implementation task per chat**, including its
tests and handoff note. Do not combine adjacent tasks merely because they look
related.

The approved pilot serves Helmand grain and mixed-goods wholesalers, Pashto-first. Its
workflow follows [ADR 0003](adr/0003-helmand-pilot-workflow.md):

```text
purchase → accept receipt → see stock and supplier debt → record supplier payment → reconcile
```

Sales, customer payments, multiple warehouses, returns, lot/grade tracking, and
offline mode are deferred. Accepted ADRs govern product policy; this plan governs
task readiness and order. Update both when an approved decision changes the scope.

## Current repository baseline (9 November 2026)

- The application shell, localization plumbing, Clerk authentication, environment
  validation, Vitest tests, and CI are implemented (Tasks 01–06).
- Exact dependency versions and quality commands live in `package.json` and its
  lockfile. The application uses App Router in `src/app` and strict TypeScript.
- Task 07 supplies the PostgreSQL/Drizzle client and explicit migration tooling;
  see its [handoff](handoffs/07-database-foundation.md). Task 08 adds a local
  organization mapping and verified Clerk membership lookup under ADR 0014.
  Task 09 supplies first-organization onboarding and local business settings.
  Task 10 supplies fixed business roles, membership-bound grants, and server guards.
  Task 11 supplies Clerk-backed staff invitation, membership management, and local
  role changes with serialized last-active-owner protection.
  Task 12 supplies exact server-side decimal, weight, money, and validation helpers
  under ADR 0019; see its [handoff](handoffs/12-domain-primitives.md).
  Task 13 supplies organization-owned weight units and product categories, exact
  unit snapshots, and their management screen under the limited ADR 0003 exception;
  see its [handoff](handoffs/13-units-product-categories.md).
  Task 14 adds tenant-owned products and their list/detail/edit screens under a
  separate ADR 0003 exception; see its [handoff](handoffs/14-products.md).
  Tasks 15/17 add suppliers and one warehouse; Tasks 18–19 add purchase drafts,
  editing, ordering and owner cancellation. Task 20 adds accepted receipts,
  inbound stock movements and receipt-based supplier debt atomically; see its
  [handoff](handoffs/20-accepted-receipts.md). Task 21 adds exact ledger-derived
  balances and paginated stock history; see its [handoff](handoffs/21-inventory-balances.md).
  Task 22 adds owner-approved signed stock adjustments under ADRs 0007/0010/0016;
  see its [handoff](handoffs/22-inventory-adjustments.md).
  Task 25 adds exact supplier cash payments, oldest-first receipt allocations and
  separately approved rounding reductions; see its [handoff](handoffs/25-supplier-payments.md).
  Task 26 adds read-only per-currency supplier balances and paginated account
  statements; see its [handoff](handoffs/26-supplier-statements.md).
  Task 27 adds append-only audit records for sensitive pilot mutations and durable
  request/completion evidence for staff provider changes; see its
  [handoff](handoffs/27-audit-logging.md).
  Task 28 adds the permission-scoped purchasing dashboard, exact stock and
  separate-currency supplier balances; see its [handoff](handoffs/28-pilot-dashboard.md).
  Task 30 adds safe error references, request correlation and redacted structured
  failure logs; see its [handoff](handoffs/30-safe-diagnostics.md).
  Task 31 adds PostgreSQL-backed shared request admission, pre-Clerk authentication
  limits and verified-user mutation budgets; see its [handoff](handoffs/31-abuse-controls.md).
  Task 32 records the critical invariant coverage, a guarded complete integration
  runner, two shuffled repeat runs and the bounded retry-hint regression fix; see
  its [handoff](handoffs/32-pilot-test-coverage.md).
  Task 16 remains deferred.
  The separately authorized
  [workspace redesign](adr/0020-workspace-design-system.md) adds Apple-inspired
  presentation and shared shadcn/ui controls for existing screens. It implements
  no numbered domain task and did not change the then-open G1 gate.
- The [30 October readiness interview](handoffs/pilot-readiness-decisions.md)
  records updated research totals, supplier-balance payment entry, a reported
  phone login, free test-hosting selection, and operating targets. These are
  documentation/policy updates; the remaining evidence gates stay open.
- CI maintenance adds a separate disposable PostgreSQL 16 verification job for
  committed migrations and the onboarding, staff, catalogue, product, supplier,
  warehouse, purchase, receipt and inventory integration suites under
  [ADR 0013's amendment](adr/0013-local-postgresql-foundation.md#amendment--disposable-ci-verification-28-october-2026).
  This does not advance Task 32 or close G1, pilot sign-in, or deployment gates.
- Preserve unrelated worktree changes.
- The founder-authorized 1 November project rename uses **BazarDaftar** and
  `atlas700/bazardaftar`; see its [handoff](handoffs/project-rename-bazardaftar.md).
  Existing infrastructure identifiers remain compatible. This advances no
  numbered domain task and did not change the then-open G1 gate.
- On 1 November the founder accepted the consolidated retrospective research and
  requested no repeated business interviews. [ADR 0003's G1 amendment](adr/0003-helmand-pilot-workflow.md#amendment--founder-acceptance-of-retrospective-g1-research-1-november-2026)
  closes G1 on that revised basis; the original 20-recorded-interview/five-observation
  checklist is not fulfilled. See the [acceptance handoff](handoffs/g1-research-acceptance.md).

### Delivery evidence and status

The delivery-order table's **Complete** label records implemented scope and
acceptance evidence in its handoff. Track these additional states separately:

- **Ready for review:** the accepted change is committed, pushed, and linked to
  an open pull request under the [GitHub delivery rules](github-rules.md).
- **Merged:** GitHub records the change merged into its target branch.
- **CI passed:** checks succeeded for a named commit; this establishes neither
  live provider acceptance nor deployment readiness.
- **Pilot verified:** the relevant live sign-in, terminology, reconciliation,
  deployment, and recovery evidence has been recorded and reviewed.

**Task 22 delivery, checked 5 November 2026:**
[PR #42](https://github.com/atlas700/bazardaftar/pull/42) is merged. Its head was
`bb9bba9d569f9bb929d80508e4c4925485df61d2`; the
[quality and PostgreSQL checks](https://github.com/atlas700/bazardaftar/actions/runs/42009750351)
passed. The original Task 22 handoff remains the dated local-evidence record.
This delivery update closes no live pilot gate. Task 25 implementation is recorded
in its [handoff](handoffs/25-supplier-payments.md) and merged in
[PR #44](https://github.com/atlas700/bazardaftar/pull/44) on 5 November with passing
CI. Task 26 implementation and local evidence are recorded in its
[handoff](handoffs/26-supplier-statements.md); it merged in
[PR #45](https://github.com/atlas700/bazardaftar/pull/45) on 7 November with passing
quality/database CI. Task 27 implementation and local evidence are recorded in its
[handoff](handoffs/27-audit-logging.md). Task 28 implementation and local evidence
are recorded in its [handoff](handoffs/28-pilot-dashboard.md); it merged in
[PR #48](https://github.com/atlas700/bazardaftar/pull/48) on 7 November.
Task 30's implementation and local checks are recorded in its
[handoff](handoffs/30-safe-diagnostics.md). Task 31's local acceptance is recorded
in its [handoff](handoffs/31-abuse-controls.md). Task 31 merged in
[PR #52](https://github.com/atlas700/bazardaftar/pull/52); its main-branch
[quality/database CI](https://github.com/atlas700/bazardaftar/actions/runs/42358039728)
passed. Task 32's acceptance and local checks are recorded in its
[handoff](handoffs/32-pilot-test-coverage.md); **Task 33** is next.
Remote CI/review and live provider acceptance remain separate delivery states.

The project rules in `AGENTS.md` and `docs/` are mandatory. In particular:

- use App Router and prefer Server Components;
- keep client components as small interactive leaves;
- validate untrusted input at every server boundary;
- do not weaken TypeScript;
- add database code only under `src/db` once persistence is actually introduced;
- use generated, reviewed SQL migrations; never use destructive schema shortcuts.

## Non-negotiable operating rules

1. **Check task readiness first.** Tasks 01–12 may proceed before G1 only when
   their specific G3/G4 prerequisites below are approved. Task 13 has the limited
   founder-authorized exception in ADR 0003 (28 October).
   Task 14 has a separate founder-authorized exception on 31 October under ADR 0003.
   Tasks 15–35 require G1 acceptance, recorded on 1 November under ADR 0003's
   revised retrospective-evidence basis. Other task-specific gates remain required.
   Documentation, dependency patches, and CI maintenance may
   proceed independently; deferred features require a new scope decision.
2. **One task, one concern.** A task must not silently add a second module,
   redesign the app, change deployment, or introduce a speculative abstraction.
3. **Inspect first.** Every agent starts by reading the current files, `git diff`,
   relevant local rules, and the prior task's handoff.
4. **Keep money exact.** Store money as PostgreSQL `numeric` (or an explicitly
   documented integer minor-unit scheme); never JavaScript floating point.
5. **Protect tenant data.** The server derives organization context from the
   authenticated membership. A client-provided `organizationId` is never authority.
6. **Record movements, not overwritten totals.** `inventory_movements` is the
   audit source for stock. A balance/read model may be derived from it but does not
   replace it.
7. **Use transactions for business events.** Receiving, fulfilling a sale, and
   allocating a payment must either completely succeed or roll back.
8. **No fake completion.** A task is complete only when its acceptance checks pass
   and the handoff note says exactly what changed and what remains.
9. **Pilot feedback wins.** Local terminology, units, credit customs, and quality
   fields are product hypotheses until real users validate them.

## The reusable prompt for every coding chat

Copy this, then replace the bracketed task reference with exactly one task below.

```text
You are continuing the BazarDaftar repository (formerly AFCS).

First inspect: AGENTS.md; the relevant docs/*.md rules; git diff; the current
implementation; the gate status and pilot delivery order in this plan; and the
latest prerequisite handoff. Preserve unrelated changes.

Implement only [TASK ID AND TITLE] from docs/agent-sized-build-plan.md.

Constraints:
- Next.js 16 App Router; keep server/client boundaries small.
- TypeScript strict; no any, ts-ignore, or weakened configuration.
- Validate all server input with Zod.
- Enforce authenticated organization membership and permissions server-side.
- Do not add functionality from later tasks or new dependencies without need.
- Use a DB transaction for an all-or-nothing financial or inventory operation.

Before the final quality-command pass: complete the pre-validation code review in
docs/testing.md and fix all must-fix findings. Then run the task's checks plus the
relevant existing checks. Summarize files changed, migration impact, review scope
and finding dispositions, test evidence, known limitations, and the exact next
task. If a product decision is missing, stop and document it rather than inventing
a policy.
```

## Gates — these are decisions, not coding tasks

### Current gate status

This table is the task-readiness record. Update it with dated evidence when a
gate changes; an accepted policy does not count as completed user research.
Research records stay private; link a redacted evidence summary rather than names
or interview transcripts.

| Gate | Status and evidence (updated 1 November 2026) | Owner | Blocks |
| --- | --- | --- | --- |
| G0 market | Accepted: [ADR 0003](adr/0003-helmand-pilot-workflow.md), amended 28 October to target Helmand grain and mixed-goods wholesalers | Founder | Market choice is resolved |
| G1 research | Accepted by founder on 1 November under [ADR 0003](adr/0003-helmand-pilot-workflow.md#amendment--founder-acceptance-of-retrospective-g1-research-1-november-2026): 50 reported interviewees, approximately 50 reported business observations, reconfirmed shared workflow, and B001 reconstructed across eight topics in the [evidence register](handoffs/g1-evidence-register.md). Original 20 individually recorded interviews/five mapped observations are not established; that prerequisite is replaced by founder acceptance. Workers' findings remain grouped; payment allocation and other unknowns stay explicit | Founder/researcher | G1 no longer blocks Task 15; acceptance alone does not establish pilot-release readiness |
| G2 scope | Founder-approved: [ADR 0003](adr/0003-helmand-pilot-workflow.md); shared workflow accepted retrospectively on 1 November, with evidence limitations retained | Founder/product lead | Features outside the approved pilot |
| G3 domain policies | [ADR 0019](adr/0019-pilot-numeric-settlement-policy.md) supplies the numeric policy and Task 12 helpers; Task 13 supplies the weight catalogue. Amended [ADR 0009](adr/0009-specific-obligation-payment-allocation.md) approves supplier-balance entry, oldest-first same-currency allocation, and no overpayments. G1 acceptance changes none of these policies. Remaining Pashto label validation and a concrete approach to real outgoing-stock reconciliation in the purchasing-only pilot are still pending | Founder/product lead | Dependent tasks must resolve concrete policy gaps; pilot labels and real stock claims require their stated validation |
| G4 authentication | Clerk accepted under [ADR 0002](adr/0002-clerk-authentication.md). On 30 October the founder reports successful real phone-code delivery and completed authentication/login. Exact test context and separate Pilot A–C outcomes were not supplied; see the [readiness record](handoffs/pilot-readiness-decisions.md) | Founder | Pilot authentication until required outcomes and deployment smoke are recorded/reviewed |
| G4 database | Accepted: [ADR 0013](adr/0013-local-postgresql-foundation.md) approves local PostgreSQL and reviewed migrations; [ADR 0014](adr/0014-clerk-organizations-local-business-roles.md), 25 October, replaces local membership ownership with verified Clerk membership and a local organization mapping | Technical lead/founder | G1 is accepted; task-specific schema checks and other G4 gates remain required |
| G4 mutation boundary | Accepted: [ADR 0015](adr/0015-server-action-mutation-boundary.md), 26 October; native Server Actions with the [mutation contract](api-conventions.md#mutation-contract) and a narrow first-organization bootstrap exception | Technical lead/founder | Boundary decision resolved; each mutation still needs its task's authorization and recovery checks |
| G4 permissions | Accepted: [ADR 0016](adr/0016-local-business-authorization.md); Task 10 implements fixed roles, membership-bound grants, and server guards. Task 25 implements ADR 0019's owner-only rounding-reduction permission | Technical lead/founder | Policy and foundation resolved; each new workflow still needs its own permission and resource-ownership checks |
| G4 deployment | Partially resolved: amended [ADR 0018](adr/0018-managed-pilot-hosting.md) selects Netlify Free/Neon Free with synthetic test records; paid production hosting is deferred, with a USD 60/month hosting/database ceiling. Approved real-pilot targets: 30-day backups, at most one hour lost entries, four-hour recovery during business hours, overseas storage, and email alerts to the founder. Exact provider/region/backup destination, separate costs, enforceable spend controls, configuration, and restore/alert evidence remain open | Founder | Task 34 still requires G1 and remaining setup decisions; pilot release requires verification |

**Next task:** 31 — rate limits and mutation abuse controls;
Task 30 implements safe user-facing failures and correlated server diagnostics.
Task 29 reports and CSV exports remain deferred until pilot evidence requires them.
Tasks 23–24 sales remain deferred under ADR 0003.
Task 16 customers remains deferred under ADR 0003.
Task 17 adds the single warehouse setup under existing business-settings permissions;
see its [handoff](handoffs/17-warehouses.md). Task 18 adds tenant-safe purchase draft
creation, list/detail views, exact price/weight snapshots, and safe retries; see its
[handoff](handoffs/18-purchase-drafts.md). Drafts do not change stock or debt.
Task 19 adds draft editing, ordering, and owner-approved cancellation with revision
checks and preserved agreement snapshots; see its [handoff](handoffs/19-purchase-lifecycle.md).
Task 20 adds accepted receipts, inbound stock movements, receipt payables, and
partial/received purchase states in one transaction; see its
[handoff](handoffs/20-accepted-receipts.md). Task 21 adds recorded inventory
balances and paginated receipt history with product filters; see its
[handoff](handoffs/21-inventory-balances.md). Outgoing-stock reconciliation remains
an open pilot gate. Task 25 implements supplier payments; Task 26 adds supplier
account balances and statements. Neither closes the live pilot gates.
Task 15 implements suppliers; see its [handoff](handoffs/15-suppliers.md) and
[contact policy](adr/0021-supplier-contact-records.md). **G1 is accepted by founder decision**
on the revised retrospective-evidence basis. Pilot release gates remain open.
Task 14 is implemented under the separate 31 October exception after the founder
was informed of the G1 blocker; see [ADR 0003's Task 14 amendment](adr/0003-helmand-pilot-workflow.md#amendment--task-14-implementation-before-g1-closure-31-october-2026)
and [Task 14 handoff](handoffs/14-products.md). Its exception did not close G1;
the separate 1 November decision now records acceptance.
Task 13 implements units and product categories under the exception authorized
on 28 October after the founder was informed of the G1 blocker; see
[ADR 0003's amendment](adr/0003-helmand-pilot-workflow.md#amendment--task-13-implementation-before-g1-closure-28-october-2026).
These historical exceptions did not establish research completion. Task 12 implements
shared domain primitives under ADR 0019; see its [handoff](handoffs/12-domain-primitives.md).
Task 11 implements staff invitation and membership
management under ADRs 0014/0016; see its [handoff](handoffs/11-staff-management.md).
Task 10 is complete; see its
[handoff](handoffs/10-business-authorization.md). Task 09 onboarding is implemented under
ADR 0015; see its [handoff](handoffs/09-first-organization-onboarding.md). Task 08's
[handoff](handoffs/08-clerk-organizations.md) and the
[readiness handoff](handoffs/task-08-09-readiness.md) record its completion.
Development Organizations and recovery slugs are on, membership is optional, and
automatic creation is off; Task 09 verifies these settings and its live flow.
ADR 0019 resolves Task 12's numeric prerequisite. G1 acceptance removes the research
blocker; pilot sign-in and deployment readiness remain open.
The [payment policy decision](handoffs/pilot-research-evidence.md#payment-policy-decision)
resolves the earlier mismatch: amended ADRs 0009/0019 and Tasks 25–26 now require
supplier-balance entry with automatic oldest-first allocation. This does not
implement posting. G1 was accepted separately on 1 November. The
[readiness handoff](handoffs/pilot-readiness-decisions.md) lists the remaining
label, authentication, and operational work.

### G0 — choose the initial market

**Owner:** founder. **Done when:** the team has named one city/province and one
business type, for example “fruit and nut wholesalers in Kandahar.” Record the
decision, why that segment was selected, expected pilot contacts, and the target
language(s). Do not select “all Afghan agricultural businesses.”

### G1 — observe the work before modelling it

**Owner:** founder/researcher. **Accepted 1 November 2026:** the founder requested
completion using the reported 50 interviews, approximately 50 observed businesses,
shared workflow, and reconstructed B001 example. Under the
[ADR 0003 amendment](adr/0003-helmand-pilot-workflow.md#amendment--founder-acceptance-of-retrospective-g1-research-1-november-2026),
this replaces the original prerequisite of 20 individually recorded interviews
and five mapped workflow observations, which remains unverified. Keep actual
records, estimates, grouped answers, and unknowns distinct. Do not reconstruct
additional businesses by copying B001. Repeated per-business interviews are not
required for this acceptance; task-specific gaps and live pilot checks remain.

### G2 — freeze the pilot workflow

**Owner:** founder + product lead. **Done when:** one document names the top three
pains, one highest-frequency/willingness-to-pay workflow, the pilot's success
metric, and explicit MVP exclusions. The accepted initial scope is purchasing,
receiving, supplier payments, and stock/supplier balance reconciliation in ADR 0003.

### G3 — resolve domain policies that code cannot safely guess

Record founder-approved policies before their dependent tasks, then validate them
against G1 research before domain implementation:

| Decision | Required answer |
| --- | --- |
| Units | Kg stock with one-gram precision; business-owned custom weight measures and actual bag-size snapshots under ADR 0019. |
| Currency and settlement | Cash only; AFN/PKR debts stay separate, while mixed cash uses recorded PKR-per-AFN rates and capped owner-only residual reductions under ADR 0019. |
| Product identity | Does grade, origin, harvest date, or quality create distinct stock? |
| Receiving | Can receipt quantity differ from order quantity, and who may approve it? |
| Supplier debt | Accepted receipt creates the supplier payable at the approved purchase price; see [ADR 0012](adr/0012-receipt-supplier-payables.md). |
| Decimal policy | Resolved by ADR 0019: two-decimal unit prices/amounts, six-decimal rates, exact conversions, half-up purchase lines/payment allocation, and cumulative receipt reconciliation. |
| Stock policy | Resolved by ADR 0007: no transaction or authorized correction may leave stock below zero. |
| Sale timing | Does stock leave at confirmation, dispatch, or delivery? |
| Credit | Supplier-balance entry with automatic oldest-first receipt allocation within one debt currency; reject overpayments and advances under amended ADR 0009. |
| Corrections | Resolved by ADRs 0010/0016: explicit owner approval and owner-only `inventory.correct`; returns remain deferred. |
| Languages | Which language launches first; which terms must be validated in Dari/Pashto? |

Capture each answer as a dated decision record. If an answer changes after pilot use,
change policy deliberately and migrate data safely; do not patch around it in UI.

### G4 — architecture approval

**Owner:** technical lead/founder. **Done when:** the initial data model, chosen auth
provider, role matrix, mutation boundary, deployment target, and backup owner are
approved. This gate prevents an agent from making irreversible infrastructure choices
by assumption.

## Build sequence

Tasks are intentionally small. “Verify” means evidence the agent must include in its
handoff, not a promise that it looked correct.

### Pilot delivery order

Task IDs remain stable for existing handoffs. Execute pilot-required tasks in
ascending order, skipping deferred tasks; each task still needs its gate approvals.
The scope column also constrains the detailed task descriptions below.

| Tasks | Classification | Pilot scope |
| --- | --- | --- |
| 01–12 | Complete | Foundation, authentication, persistence, tenancy, onboarding, local authorization, staff management, and domain primitives; see [handoffs](README.md) |
| 13 | Complete | Units/categories; founder-authorized G1 exception on 28 October under ADR 0003 |
| 14 | Complete | Products; founder-authorized G1 exception on 31 October under ADR 0003 |
| 15 | Complete | Suppliers; approved Individual/Business types under ADR 0021; see [handoff](handoffs/15-suppliers.md) |
| 16 | Deferred | Customers |
| 17 | Complete | One warehouse per business; owner/admin setup under ADRs 0003/0016; see [handoff](handoffs/17-warehouses.md) |
| 18–22 | Complete | Purchases, accepted receipts/payables, stock, owner-approved corrections; see handoffs 18–22 |
| 23–24 | Deferred | Sales drafts and fulfilment |
| 25 | Complete | Supplier cash payments, automatic oldest-first allocation and owner-only rounding reductions; see [handoff](handoffs/25-supplier-payments.md) |
| 26 | Complete | Read-only supplier balances and paginated statements; see [handoff](handoffs/26-supplier-statements.md) |
| 27 | Complete | Append-only audit trail, atomic local events and durable provider intents; see [handoff](handoffs/27-audit-logging.md) |
| 28 | Complete | Permission-scoped purchasing/stock/supplier dashboard; see [handoff](handoffs/28-pilot-dashboard.md) |
| 29 | Deferred | CSV/report suite until pilot evidence requires it |
| 30 | Complete | Safe failures, request references and redacted structured logs; see [handoff](handoffs/30-safe-diagnostics.md) |
| 31 | Complete | Shared request limits for authentication and mutations, safe rejection and retry/idempotency verification; see [handoff](handoffs/31-abuse-controls.md) |
| 32 | Complete | Critical invariant register, guarded integration discovery, repeat runs and bounded request retry hints; see [handoff](handoffs/32-pilot-test-coverage.md) |
| 33–35 | Pilot required | Purchase-to-payment E2E, staging, onboarding |

### Foundation

#### 01 — Create the product decision and engineering documentation shell

**Goal:** Establish durable context before code changes.

**Do:** Add concise documents for product requirements, architecture, database,
API conventions, security, testing, deployment, and an ADR directory. Seed them
with confirmed baseline facts and clearly labelled open decisions from G0–G4.

**Do not:** choose an auth vendor, schema policy, or hosting service in this task.

**Verify:** links are valid; no requirement is presented as confirmed when it is an
assumption.

**Handoff:** list every unresolved decision and point to its document.

#### 02 — Establish app quality commands and CI baseline

**Goal:** Make all later changes routinely checkable.

**Do:** Add only the minimum scripts/configuration required to run lint, TypeScript
type checking, unit tests, and a production build locally and in CI. Add a small CI
workflow that uses the lockfile and runs those checks.

**Do not:** add browser E2E infrastructure yet; that is Task 33.

**Verify:** a clean checkout can run every listed command; CI configuration matches
those commands.

**Handoff:** state the exact commands and any required Node version.

#### 03 — Add runtime environment validation

**Goal:** Fail safely and clearly when server configuration is missing or malformed.

**Do:** Define a server-only typed environment module and a complete redacted
`.env.example`. Validate only values that exist at this stage; document where secrets
are set in local, staging, and production environments.

**Do not:** expose secrets through `NEXT_PUBLIC_*`, add real credentials, or connect
to an external service.

**Verify:** invalid required configuration yields an actionable startup error; the
example contains no secret.

**Handoff:** name the variables and their purpose, never their values.

#### 04 — Build the application shell and accessible navigation

**Goal:** Replace the starter page with the authenticated-app layout shape without
pretending feature pages exist.

**Do:** Create the responsive shell, route groups, sidebar/mobile navigation,
empty-state pages, metadata, and an accessible visual token baseline. Include a
temporary unauthenticated landing/sign-in placeholder only if auth is not ready.

**Do not:** build dashboard data, CRUD forms, or hard-code business data.

**Verify:** keyboard navigation, a phone-size layout, and wide layout work; `build`,
lint, and type checks pass.

**Handoff:** document route structure and which pages are intentional placeholders.

#### 05 — Add localization and RTL plumbing

**Goal:** Make translation and right-to-left support a foundation, not a late rewrite.

**Do:** Use the approved localization approach and G3 launch-language decision.
Add a minimal translation provider, locale preference storage plan, direction
switching, and English plus clearly marked placeholder resources for validated
launch language(s).

**Do not:** machine-translate business terms, localize every future screen, or make
locale a client-controlled authorization input.

**Verify:** a small representative page renders in LTR and RTL; no new user-facing
strings are hard-coded in that page.

**Handoff:** identify the translation files and unvalidated terminology.

### Identity, tenancy, and database base

#### 06 — Decide and integrate authentication only

**Goal:** Implement the approved authentication provider with a secure session.

**Do:** Follow the selected provider's current documentation, add sign-in/sign-out,
server-side session lookup, and protected-route behavior. Keep provider-specific code
behind a small local auth module.

**Do not:** build organizations, roles, invitation flows, or custom password
cryptography here.

**Verify:** anonymous users cannot reach a protected page; authenticated users can;
session cookies follow the provider's secure production guidance.

**Handoff:** document provider, session boundary, required environment variables, and
test-account setup.

#### 07 — Introduce PostgreSQL, Drizzle, and migration workflow

**Goal:** Add persistent storage with a repeatable local workflow.

**Do:** Install PostgreSQL/Drizzle dependencies, create the server-only DB client,
Drizzle configuration, local database instructions, and one harmless baseline
migration. Document generation, review, and application commands.

**Do not:** use `drizzle-kit push` for shared environments or create domain tables.

**Verify:** a fresh local database can apply the migration; generated SQL is reviewed
and committed; production build has no client DB import.

**Handoff:** record the migration command and rollback/recovery expectation.

#### 08 — Model organization membership and tenant context

**Goal:** Make an organization the ownership boundary for all future business data.

**Do:** Follow [ADR 0014](adr/0014-clerk-organizations-local-business-roles.md): add
one local `organizations` table with generated UUID, unique required Clerk
organization ID, and UTC creation timestamp. Clerk owns membership. Verify the
session's active organization/user pair through the Backend API before resolving
the local UUID. Return no context for absent/mismatched membership or missing local
mapping; fail closed with sanitized errors on service failures. Reads never create
organizations or choose a different membership.

**Do not:** trust organization ID from a form/query string, mirror memberships,
cache membership across requests, add roles, or expose organization management UI.

**Verify:** a user with no membership has no active organization; membership lookup
cannot return another tenant's organization.

**Handoff:** give the schema summary and tenant-context function contract.

#### 09 — Implement first-organization onboarding

**Goal:** Let an authenticated owner create their business safely.

**Do:** Follow ADR 0015 and the [Task 09 bootstrap contract](api-conventions.md#task-09-bootstrap)
to add a validated Server Action and minimal form. Derive the authenticated creator
on the server and verify their current creator membership before provisioning or
recovery. Use Clerk organization creation and its creator membership, then
idempotently provision the local organization/settings. Remote Clerk provisioning
cannot share a PostgreSQL transaction: define recovery for partial success and
retries without duplicating organizations. Include name, business type, timezone,
base currency (`AFN` by default), and locale only where G3 has approved defaults.

**Do not:** expose general organization switching, invitations, or billing.

**Verify:** unauthenticated or mismatched creators are denied; duplicate/concurrent
submission does not create duplicate owner organizations; invalid input is shown
safely; partial remote/local success is recoverable; unexpected failures are safe
and correlatable; the organization becomes active only after local provisioning succeeds.

**Handoff:** describe the idempotency/duplicate-submission behavior.

#### 10 — Define roles, permissions, and the authorization guard

**Goal:** Enforce action-based RBAC on the server.

**Do:** Follow [ADR 0016](adr/0016-local-business-authorization.md): define the seven
owner/admin/manager/warehouse/sales/accountant/viewer defaults and action catalogue
in code, store one local role per verified membership, and add a server-only
`requirePermission()` guard for mutations and protected data queries. Bootstrap
the first owner once through verified onboarding, with a durable marker committed
atomically with the grant; reads and retries never restore changed/deleted grants.
Business roles stay local under ADR 0014; Clerk Admin/Member roles are not business
authorization. Removal/rejoining must not restore old business grants.

**Do not:** rely on hiding buttons as authorization or build staff management UI.

**Verify:** unit tests show a non-member is denied and representative permitted and
forbidden actions are enforced server-side.

**Handoff:** include the permission matrix and guard usage example.

#### 11 — Add staff invitation and membership management

**Goal:** Let an owner/admin manage pilot staff without weakening tenant isolation.

**Do:** Use Clerk's membership/invitation APIs behind the approved local permission
guards. Build add/invite, local business-role change, deactivate, and list flows.
Prevent removal/demotion of the last active owner; remote removal must revoke
access even while a session still carries the former organization claim.

**Do not:** create arbitrary custom roles or send real email/SMS if no provider is
configured; show a safe manual-invite workflow if necessary.

**Verify:** an admin cannot alter another organization; the last-owner invariant is
tested.

**Handoff:** specify invitation expiry and recovery procedure.

### Master data

#### 12 — Add shared domain primitives for money, quantities, and status transitions

**Goal:** Give later modules one precise vocabulary without building a giant shared
framework.

**Do:** Define narrowly scoped server-side helpers/types for decimal input/output,
quantity validation, UTC timestamps, IDs, and explicit status-transition checks.
Implement [ADR 0019](adr/0019-pilot-numeric-settlement-policy.md): kg/gram weight,
two-decimal entered unit prices, separate quantity/price measures, exact conversion
ratios, half-up two-decimal monetary lines, cumulative receipt reconciliation,
and mixed-currency allocation at positive PKR-per-AFN rates of at most six decimals.
Reject unsupported precision without silent rounding. Purchase totals sum rounded
lines; rounded payment allocations use combined cash value in the debt's currency.
Provide narrow pure checks for whole cash and the 0.99 lifetime reduction cap;
Task 25 owns authorization and transactional enforcement.

**Do not:** write a generic ORM repository, a client-side financial calculator, or
convert values to JavaScript floats.

**Verify:** unit tests cover decimal parsing, rejected negative quantities, rounding,
and invalid transitions. Include multiple lines whose rounded sum differs from
rounding their unrounded aggregate; preserve the approved per-line result.
Cover half-cent ties, gram precision/custom weights, differing price measures,
cumulative receipts, both exchange directions, rejected rate precision, and
cumulative reduction limits under ADR 0019. No live rates or payments are needed.

**Handoff:** state where each primitive may be imported from.

#### 13 — Implement units and product categories

**Readiness at delivery:** Founder-authorized exception to G1 on 28 October under
ADR 0003; G1 was then open and was separately accepted on 1 November.
Use approved measure definitions only; start categories empty.

**Goal:** Support the small vocabulary required to create products.

**Do:** Add organization-owned units and categories, schema/migration, list/create/
edit/deactivate services, and their minimal management screens. Seed only validated
pilot defaults. Support kilograms, maan, khorwar, fractions, and actual bag sizes
under ADR 0019, normalized to kg with gram precision. Allow business-owned named
weight measures under `catalog.manage`; snapshot definitions on transactions.

**Do not:** build arbitrary formulas or non-weight conversions, global uncontrolled
units, or product pricing. Measure edits never rewrite historical transactions.

**Verify:** tenant scoping, uniqueness rule, permissions, validation, and
deactivation behavior have tests. Cover fractional weights, 10/11-maan bags, and
equivalence of 100 maan and 440 kg without losing the entered measure. Test custom
measure isolation, sub-gram rejection, and historical snapshot preservation.

**Handoff:** record the selected product-unit policy from G3.

#### 14 — Implement products

**Readiness at delivery:** Founder-authorized exception to G1 on 31 October under
ADR 0003; G1 was then open and was separately accepted on 1 November. Product-level
default prices are deferred until validated; category is optional and weight unit required.

**Goal:** Create an organization-scoped product catalogue.

**Do:** Add products with validated name, optional SKU/code, category, stock unit,
default purchase/selling price if validated, active state, and product list/detail/
edit screens. Any default price must retain its currency and price measure under
ADR 0019. Add appropriate per-organization uniqueness constraints.
Authorized users enter their business's product names as needed; do not restrict
products to a predefined goods list. This does not change ADR 0003's pilot market
or close the G1 evidence gate.

**Do not:** add batch/lot/grade/origin fields unless G3 says they define stock
identity; do not compute inventory yet.

**Verify:** SKU uniqueness (when supplied), tenant denial, inactive product behavior,
and form validation are tested.

**Handoff:** name any deliberately deferred product attributes.

#### 15 — Implement suppliers

**Readiness at delivery:** G1 accepted on 1 November. The founder authorized this
task and selected Individual/Business supplier types; [ADR 0021](adr/0021-supplier-contact-records.md)
records the bounded contact fields, optional classification, and descriptive terms.

**Goal:** Manage purchase counterparties.

**Do:** Add supplier schema/services/screens with name, phone, location, approved
type, notes, payment terms, and active state. Phone is a contact value, not an
authentication credential.

**Do not:** persist a mutable supplier balance; payments/payables come later.

**Verify:** create/edit/deactivate, tenant isolation, permission denial, and field
validation are covered.

**Handoff:** describe the chosen supplier types and deferred fields.

#### 16 — Implement customers

**Scope:** Deferred under ADR 0003; a new scope decision is required to start.

**Goal:** Manage sales counterparties.

**Do:** Add customer schema/services/screens with name, phone, location, type, notes,
active state, and credit limit only if G3 defines its enforcement policy.

**Do not:** store a mutable customer balance or imply a credit limit is enforced if
its rule is undecided.

**Verify:** equivalent supplier-style checks plus the selected credit-limit behavior.

**Handoff:** note the credit policy used by future sale tasks.

#### 17 — Implement warehouses

**Readiness at delivery:** G1 accepted on 1 November. Implemented under ADR 0003's
single-warehouse scope and ADR 0016's `organization.read` / `organization.manage`
business-settings permissions. See the [handoff](handoffs/17-warehouses.md).

**Goal:** Identify stock locations for pilot transactions.

**Do:** Add one organization-owned warehouse and the minimal setup needed to choose
it for purchases and receipts. Enforce approved staff permissions.

The Settings screen stores a required name (1–80 characters), optional location
(at most 200 characters), and active state. Owner/admin can create, edit, deactivate,
and explicitly reactivate the same stable record. Every approved role can read.
Uniqueness across active and inactive rows prevents a second warehouse; no delete
or replacement flow is exposed. Selection returns only an active tenant warehouse;
future transaction writes must recheck ownership and active state in their transaction.

**Do not:** add multiple warehouses, warehouse switching/transfers, bins, or stock
quantities in this task.

**Verify:** an inactive warehouse cannot be chosen for new transactions and tenant
isolation is tested.

**Handoff:** record the single-warehouse constraint from ADR 0003.

### Procurement and inventory

#### 18 — Create purchase orders as drafts

**Status:** Implemented 2 November 2026 under ADRs 0003/0016/0019/0020; see the
[handoff](handoffs/18-purchase-drafts.md). Only `draft` is writable in this task.
Tasks 19–20 add subsequent lifecycle transitions and receipt posting.

**Goal:** Record an intended supplier purchase without changing stock or debt.

**Do:** Add purchase order/item schema and a create/list/detail flow. Validate active
supplier, products, warehouse, positive item quantities, non-negative prices, totals,
and permitted draft status transitions. Record currency, entered weight measure,
actual bag size when applicable, and separate agreed price measure under ADR 0019. Calculate
totals server-side in the purchase's currency.

**Do not:** receive stock, create supplier payable, or accept client-calculated totals
as truth.

**Verify:** invalid item data rolls back the whole draft creation; totals and
permissions have unit/integration tests.

**Handoff:** document purchase statuses and their meaning.

#### 19 — Implement purchase order editing, ordering, and cancellation

**Goal:** Complete non-stock-affecting purchase lifecycle states.

**Do:** Permit only approved transitions (`draft → ordered → partially_received /
received` later; cancellation according to policy) and allow edits only in safe
states. Write audit events through the shared audit interface if it exists; otherwise
leave an explicit integration point for Task 27.

Task 19 permits draft edits, `draft → ordered`, and owner-approved
`draft / ordered → cancelled` under ADRs 0010/0016. Ordered/cancelled purchases
are read-only; cancelled is terminal. Persist approval identity, UTC times and
a cancellation reason. Revision guards prevent stale overwrites. Retain unchanged
selected reference/weight snapshots, use current snapshots for new selections,
and preserve creation retry identity. Received states and any cancellation with
posted receipts require later reconciliation work and are not enabled here.

**Do not:** allow editing received quantities through the order or delete historical
orders.

**Verify:** transition matrix tests reject invalid edits/cancels and preserve tenant
scope.

**Handoff:** list exact preconditions for Task 20 receipt.

#### 20 — Accept receipts, append stock movements, and create supplier payables

**Goal:** Turn an accepted physical receipt into stock history and supplier debt.

**Do:** Add goods receipt, inventory movement, and supplier payable schema, then a
single transactional service/UI to accept quantities against an eligible purchase.
Validate supplier, warehouse, active product, remaining ordered quantity, stock unit,
and owner approval for variances. Append inbound movements and create one payable
per accepted receipt using accepted quantities and approved purchase-price snapshots
under [ADR 0012](adr/0012-receipt-supplier-payables.md). Update purchase status in the
same transaction. Enforce receipt-request uniqueness and concurrent quantity limits
in the database so retries cannot duplicate stock or debt. Compare quantities in
the product's stock unit while preserving the entered weight/bag-size and price
snapshots. Keep receipt payables in the purchase currency and derive each line's
debt as rounded cumulative accepted value less previously recognized value under
ADR 0019. Commit quantity/value reconciliation together across concurrent receipts.

**Do not:** overwrite a `stock_quantity` field as the source of truth, recognize
debt at draft/order creation, add supplier invoice entry, or support returns.

**Verify:** integration tests cover partial receipts and approved variances at the
approved price; failure at any write leaves no receipt/movement/payable/status
change; concurrent/repeated requests neither duplicate stock/debt nor exceed
approved limits; receipt, stock, and payable references remain tenant scoped.
Test the 100 AFN three-receipt case (33.33/33.34/33.33) and exact full reconciliation.

**Handoff:** record movement/payable fields, receipt-number and idempotency strategy,
and evidence that stock and supplier debt reconcile to accepted receipt lines.

#### 21 — Add inventory balances and stock history read models

**Goal:** Show usable current stock while retaining the ledger as truth.

**Do:** Implement a server-side aggregate/query for current quantity by
organization/product/warehouse and a paginated movement history. Add indexes only for
these demonstrated queries. Define and document available-stock calculation.
Aggregate equivalent weight entries in kg under ADR 0019;
do not add bag counts with differing weights as if they were equivalent.

**Do not:** cache or denormalize balances before profiling; implement transfers,
adjustments, or valuation.

**Verify:** ledger aggregate equals expected receipts in integration tests; cross-
tenant filters and pagination are tested; inspect non-trivial query plan if data size
warrants it.

**Handoff:** state whether a materialized/derived balance table is still unnecessary.

#### 22 — Implement controlled inventory adjustments

**Readiness:** Implemented under accepted ADR 0007 (no negative stock), ADR 0010
(explicit owner approval), and ADR 0016 (`inventory.correct`, owner only). The
earlier unresolved-policy note was stale; no new product decision was required.
See the [handoff](handoffs/22-inventory-adjustments.md).

**Goal:** Record loss, spoilage, count corrections, or opening stock transparently.

**Do:** Add an adjustment command that appends a signed movement with reason,
reference, performer, timestamp, and validation against the negative-stock policy.
Restrict it to the G3-approved permission.

**Do not:** permit free-form deletion or editing of ledger rows; build stock transfer
or product returns.

**Verify:** users without permission are denied; adjustment reason is required;
negative stock policy and audit trail are tested.

**Handoff:** list accepted reason codes and deferred correction workflows.

### Sales, credit, and payments

#### 23 — Create sales orders as drafts

**Scope:** Deferred under ADR 0003; a new scope decision is required to start.

**Goal:** Capture a proposed sale without moving stock or changing balances.

**Do:** Add sales order/item schema and draft create/list/detail screens. Validate
active customer/products, quantity, non-negative pricing/discount, server-calculated
totals, and selected warehouse. Include the product price snapshot needed for history.

**Do not:** reserve stock, decrement stock, issue invoices, or record payment yet.

**Verify:** all invalid lines roll back draft creation; totals/discounts and tenant
authorization are covered by tests.

**Handoff:** document sale statuses and chosen sale-timing policy.

#### 24 — Confirm and fulfil a sale

**Scope:** Deferred under ADR 0003; a new scope decision is required to start.

**Goal:** Make the approved physical-sale event reduce stock exactly once.

**Do:** Implement only the G3-approved lifecycle. In one DB transaction validate
available stock, transition state, append outbound inventory movements, and create
the sale's financial obligation/invoice record if that is the approved model.
Prevent duplicate submit/replay from creating a second outbound movement.

**Do not:** allow negative stock, cancellation reversal, returns, delivery routes, or
front-end-only stock checks.

**Verify:** insufficient stock rolls back everything; concurrent/repeated fulfilment
cannot double-decrement stock; a successful sale appears in stock history.

**Handoff:** specify the idempotency strategy and later reversal requirements.

#### 25 — Record and allocate supplier payments

**Goal:** Settle receipt-based supplier debt without corrupting balances.

**Readiness:** The [30 October decision](handoffs/pilot-research-evidence.md#payment-policy-decision)
amends ADRs 0009/0019 and this task together. G1 acceptance and Task 20's receipt
payables remain prerequisites.

**Do:** Add supplier payments and payment allocations under ADR 0009. Record the
supplier, debt currency, date, whole AFN/PKR cash amounts, and reference/note.
Staff do not select a receipt. Allocate automatically to the supplier's oldest
unpaid Task 20 receipt payables within the server-derived organization and chosen
currency, with deterministic ordering for ties. One payment may settle several
receipts and part of the next. Under ADR 0019, snapshot the supplier-agreed rate
(PKR per AFN, at most six decimals) when converting; calculate the combined cash
value exactly, round half-up once to two decimals, and distribute that amount
without per-allocation conversion or rounding. Persist the payment and its
allocation rows so their amounts reconcile to the converted cash value.
Reuse `supplier_payments.record` for payment/rate entry. Introduce the fixed
owner-only `supplier_payments.adjust_rounding` permission for explicit residual
reductions with reason/provenance. Cap all reductions cumulatively at 0.99 in
the payable's currency; retain original debt/cash and append adjustments separately.
Record adjustment audit evidence in this task, without waiting for Task 27.
Serialize supplier-total and per-payable balance/cap checks and all postings
transactionally, with idempotency. A supplier-level entry never pools or resets
the lifetime reduction caps of its payables.

**Do not:** add customer payments or supplier advances/unapplied credit, mix debt
currency balances, integrate online payment rails or live rate feeds, revalue old
payments, overwrite balances, silently discard residual debt, or exceed the
supplier's outstanding total in the chosen currency or any payable's balance.
Larger rounding differences remain outstanding.

**Verify:** oldest-first allocation across several receipts, deterministic ties,
partial/full payment, zero-balance and overpayment rejection, concurrent allocation,
duplicate requests, both exchange directions, immutable rates, whole cash/rate
validation, unauthorized reduction denial, lifetime cap races/retries, separate
adjustment audit, and tenant isolation are tested against Task 20 payables.
A failed posting leaves cash, allocation, reduction, and balance unchanged.

**Handoff:** document balance derivation and payment idempotency; customer receipts
and unapplied credit remain deferred. State the ordering/tie-break rule and show
that allocation totals equal the converted payment without double-counting cash.

#### 26 — Implement balances and transaction statements

**Goal:** Give staff a trustworthy supplier account view.

**Do:** Build read-only supplier balances and paginated statements using Task 20
receipt payables and Task 25 payment allocations. Show outstanding amounts and links
to accepted receipts and supplier payments; show due dates only under approved terms.
Keep AFN and PKR balances and statement totals separate under ADR 0019. Show
original cash, rate, converted allocation, and owner-approved reductions distinctly;
reconcile debt less allocations and reductions without presenting reductions as cash.
Show each supplier payment once in account totals, with its receipt allocations
available for traceability; do not repeat the full cash amount per allocation row.

**Do not:** add customer statements, complex accounting journals, interest,
installment plans, or changes to historical obligations.

**Verify:** expected balances for no, partial, full, and multi-receipt payments
are tested; statement entries reconcile to the displayed balance in each currency
without counting one payment more than once.

**Handoff:** list reports that can safely reuse these queries.

### Reporting, reliability, and delivery

#### 27 — Add append-only audit logging

**Status:** Implemented 7 November 2026. See the [handoff](handoffs/27-audit-logging.md)
for acceptance, retention/access/redaction, source coverage and the explicit
Clerk/PostgreSQL boundary. No audit reader/UI or historical backfill is introduced.

**Goal:** Make sensitive operational events traceable.

**Do:** Add `audit_logs` schema and a small server-only audit writer. Record actor,
organization, action, entity/type/id, timestamp, request/correlation ID, and safe
before/after snapshots for the listed sensitive events. Wire it into organization
staff changes, master-data changes, receipts/payables, adjustments, and supplier
payments. Fulfilment/customer-payment events belong to the deferred sales work.

**Do not:** log passwords, sessions, secrets, or unlimited sensitive personal data;
do not make audit writes silently optional for critical completed transactions.

**Verify:** an audit event is written in the same transaction as representative
critical operations; unauthorized failure does not create a success event.

**Handoff:** document retention, access permission, and redaction policy.

#### 28 — Build the pilot dashboard

**Status:** Implemented 7 November 2026. See the [handoff](handoffs/28-pilot-dashboard.md)
for source queries, permissions, exact reconciliation and local verification limits.

**Goal:** Surface only metrics supported by trusted data.

**Do:** Implement a server-rendered dashboard for purchases, accepted receipts,
current stock quantities, outstanding supplier balances, and recent pilot
transactions. Keep AFN/PKR amounts separate under ADR 0019. Use real
empty/error/loading states.

**Do not:** add sales/customer metrics, stock valuation, speculative low-stock
thresholds, fabricated forecasts, or an N+1 query per card.

**Verify:** numbers match fixture/integration data, tenant filters are enforced, and
small screens remain usable.

**Handoff:** identify each metric's source query and policy assumptions.

#### 29 — Add core reports and CSV exports

**Scope:** Deferred until pilot evidence requires reports beyond Task 26 statements
and Task 28 dashboard; a scope decision must select each report before starting.

**Goal:** Provide the pilot's validated reporting needs.

**Do:** Deliver reports one at a time behind the same shared date/filter validation:
sales, purchases, inventory movement/current stock, customer balances, and supplier
balances. Generate CSV server-side with authorization, stable columns, locale-safe
dates, and spreadsheet-injection-safe text cells.

**Do not:** generate PDF, allow arbitrary expensive date ranges, or start a background
job queue unless report size demonstrably requires it.

**Verify:** report totals reconcile with source transactions; CSV is authorized,
correctly escaped, and tested.

**Handoff:** state report limits and whether async generation is needed later.

#### 30 — Add user-facing errors, request IDs, and structured server logs

**Status:** Implemented 7 November 2026; see the [handoff](handoffs/30-safe-diagnostics.md)
for acceptance, local checks and live-evidence limits.

**Goal:** Make pilot failures diagnosable without exposing internals.

**Do:** Establish a consistent error shape, route/page error boundaries where useful,
request/correlation IDs, and structured logs for auth/DB/transaction failures.

**Do not:** expose stack traces, SQL, secrets, or personal data to browser users; do
not log every successful request at noisy full-payload detail.

**Verify:** force a representative invalid request and server failure; the user gets a
safe message while logs contain a correlatable internal event.

**Handoff:** specify where logs are viewed and what is redacted.

#### 31 — Add rate limits and mutation abuse controls

**Goal:** Protect authentication and high-value mutations at pilot scale.

**Do:** Choose a deployment-compatible rate-limit mechanism, apply it to auth and
high-risk mutation endpoints/actions. Verify the duplicate-submission protections
already required by receipt/payable and supplier-payment tasks; close any gaps.

**Do not:** build a distributed queue or claim rate limiting works across instances
without a shared store.

**Verify:** configured limits return a consistent safe response; legitimate retry is
handled by the idempotency policy; implementation limits are documented.

**Handoff:** state keys, windows, storage, and operational limitation.

#### 32 — Add focused unit and integration test coverage

**Goal:** Lock down the pilot's financial, inventory, tenancy, and permission invariants.

**Do:** Add test helpers/fixtures and tests for only the critical domain services:
tenant access, RBAC, totals, purchase transitions, receiving/payable creation,
adjustments, and supplier-payment allocation. Use a disposable test database for
integration tests. Each implementation task already requires its own behavior tests;
this task closes remaining pilot gaps rather than deferring those tests until here.

**Do not:** chase coverage percentages or test framework internals.

**Verify:** tests run independently/repeatedly without leaking database state; each
critical invariant has a named failing-case test.

**Handoff:** list test command, test DB requirements, and important untested risks.

#### 33 — Add one end-to-end pilot workflow

**Goal:** Test the founder's most important real-user path in a browser.

**Do:** Add Playwright (or the approved E2E tool) and exactly one deterministic
scenario: authenticate → organization → product/supplier/one warehouse → purchase
→ accept partial receipt → verify stock and payable → pay supplier → verify stock
unchanged and outstanding supplier balance reduced. Use seeded isolated data and
include a retry that proves a receipt cannot duplicate stock or debt.

**Do not:** require customers, sales, multiple warehouses, a brittle screenshot
suite for every page, or a shared development database.

**Verify:** the scenario runs headlessly in CI and produces artifacts on failure.

**Handoff:** document local run command, seeding, and known browser coverage gap.

#### 34 — Deploy a staging environment with migrations and backups

**Goal:** Create a safe place for pilot rehearsal.

**Do:** Containerize only if it matches the approved deployment target; configure
staging environment variables, managed/self-hosted PostgreSQL access, migration-on-
deploy process, health check, database backup schedule, restore drill, and uptime/
error monitoring.
Follow amended ADR 0018: Netlify Free/Neon Free is the temporary test target with
synthetic business records, while paid production hosting remains to be selected.
The founder owns operations. Before paid setup, settle the exact provider,
supported region, backup destination, separate authentication/SMS/domain costs,
and enforceable spending controls within the USD 60/month hosting/database ceiling.
Implement 30-day backup retention, at most one hour of lost recent entries, and
service recovery within four hours during business hours. Email downtime,
backup-failure, and spend alerts to the founder. Overseas storage is allowed;
keep temporary test, staging, and production data separate. Free testing does not
waive G1 or establish that Task 34 is complete.

**Do not:** expose production data in staging, auto-run destructive migrations, or
launch publicly before access controls are tested.

**Verify:** a fresh staging deploy works; migration history is visible; backup
retention and spending controls are checked; alert delivery works; and a
non-production restore demonstrates the approved data-loss and business-hours
recovery targets. Record end-to-end sign-in in the deployed environment.

**Handoff:** name deploy owner, rollback procedure, backup location/retention, and
restore evidence date.

#### 35 — Pilot onboarding, support, and measurement

**Goal:** Turn deployed software into a learning experiment.

**Do:** Create an onboarding checklist, initial data-import/manual entry procedure,
support contact/runbook, consent-aware product event plan, and a weekly pilot review
template. Track time-to-first-value, weekly active organizations, completed real
transactions, workflow failures, and requested changes.

**Do not:** build a nationwide self-service acquisition funnel, marketplace, billing
integration, or speculative analytics.

**Verify:** one internal dry run can onboard a test business from blank account to
first completed workflow; metrics can be reviewed weekly without inspecting raw logs.

**Handoff:** list pilot businesses only in private operational records, not repository
fixtures.

## Explicitly deferred backlog

Do not schedule these until the pilot reaches repeated use and paid retention:

- returns/cancellation reversals and stock transfers (bring forward only if pilots
  cannot operate without them);
- batch/lot/quality/origin tracking;
- currencies beyond AFN/PKR and automatic exchange-rate feeds;
- native mobile apps and full offline transaction queues/conflict resolution;
- PDF invoices, attachments, images, SMS/WhatsApp, email campaigns;
- public marketplace, farmer app, logistics/fleet, warehouse bins, public APIs;
- price forecasting/AI, financing, payments infrastructure, export documentation;
- microservices, Redis/BullMQ, and advanced caching.

When a deferred item becomes necessary, create a new decision record and split it
into a schema task, domain-service task, UI task, and test task. Do not bolt it onto
an unrelated milestone.

## Pilot-release checklist

Before allowing a real business to depend on the app, confirm:

- [ ] G0–G4 are documented and approved.
- [x] G1 is accepted on retrospective founder evidence under ADR 0003's 1 November
      amendment; the original individually recorded evidence checklist is unverified.
- [ ] Remaining Pashto terms are validated, and real outgoing stock can be
      reconciled within the approved pilot scope.
- [ ] Only pilot-required tasks are included; deferred features have not become
      release prerequisites.
- [ ] Only invited, authenticated members can access one organization’s data.
- [ ] Owner/admin/operational permissions have denial tests.
- [ ] Accepted receipt, inventory movements, supplier payable, and purchase status
      commit atomically; retries/concurrent receipt requests cannot duplicate stock
      or debt.
- [ ] Owner-approved stock adjustments and supplier-payment allocations are
      transactional and idempotent where retries can occur.
- [ ] Stock and balances reconcile from their source records for representative data.
- [ ] Partial/full supplier payments reconcile to receipt payables without exceeding
      the outstanding amount, including concurrent requests.
- [ ] Audit events exist for sensitive completed actions.
- [ ] User-facing errors are safe; logs contain correlation IDs without secrets.
- [ ] The critical E2E workflow passes in staging.
- [ ] Production dependencies pass `npm audit --omit=dev --audit-level=high`.
- [ ] A database backup and a non-production restore have been verified.
- [ ] A founder can onboard and support the pilot business manually.

## How to resume after any agent stops

1. Read `git status`, `git diff`, this plan, and the latest relevant docs/ADR.
2. Run the existing quality commands before editing; distinguish pre-existing failures
   from new failures.
3. Read only the current task and its immediate prerequisite—not the whole backlog.
4. Finish or revert only changes belonging to that task; never discard other people’s
   work.
5. Record a handoff note with: completed acceptance checks, changed files, migrations
   and environment variables, test commands/results, known limitation, and next task.

The first pilot succeeds when one business records every purchase and receipt for
four weeks and can verify stock and supplier balances, as defined in ADR 0003.
Three paying businesses remain a later expansion goal; deferred sales features do
not block this pilot.
