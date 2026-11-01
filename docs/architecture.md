# Architecture

## Confirmed baseline

- The repository is a Next.js 16 App Router application with React 19, strict
  TypeScript, Tailwind CSS 4, and ESLint. Exact versions live in `package.json` and
  its lockfile.
- Routes and layouts live in `src/app`; the Clerk integration lives in `src/auth`.
- `src/domain` contains Task 12's server-only pure decimal, weight, monetary, UUID,
  UTC timestamp, and explicit-transition helpers. They validate inputs and keep
  ratios exact with native `bigint`; decimal strings cross public boundaries.
  Import contracts and technical limits are in the [handoff](handoffs/12-domain-primitives.md).
- Clerk supplies identity and session management. Each application page calls the
  server-only `requirePermission()` guard; onboarding and staff access use `requireSession()` and
  the sign-in page uses `getSession()`.
- The proxy composes Clerk session handling with General Translation locale
  handling. Route protection stays in each resource, following Clerk 7 guidance.
- Vitest covers configuration validation, session/page access, verified Clerk
  membership, tenant context, onboarding, and the fixed permission matrix; opt-in
  PostgreSQL tests cover bootstrap concurrency, rollback, and grant isolation.
- PostgreSQL persistence uses a server-only Drizzle/`pg` pool under `src/db`, with
  explicit reviewed migrations. The sole business-ownership table is
  `organizations`, mapping a generated local UUID to a unique Clerk organization
  ID. `organization_settings` holds business settings; `organization_onboarding`
  holds one durable setup request and one-time owner membership marker per creator.
  `organization_role_assignments` stores only local business grants, not a
  membership mirror. Membership lives in Clerk. A general UI-component library is
  not installed.
- Localization uses General Translation with English and Pashto; its runtime
  translation service remains disabled until terminology and credentials are ready.
- Future application work follows the App Router and favors Server Components with
  small client-side interactive leaves.

## Decision status

**Partially decided — G4 architecture approval:** Clerk is the approved pilot
authentication provider; see [ADR 0002](adr/0002-clerk-authentication.md). The
structural ownership model and local migration/recovery workflow are approved in
[ADR 0013](adr/0013-local-postgresql-foundation.md), with membership ownership
revised by [ADR 0014](adr/0014-clerk-organizations-local-business-roles.md).
UI mutations use Next.js Server Actions under
[ADR 0015](adr/0015-server-action-mutation-boundary.md).
[ADR 0016](adr/0016-local-business-authorization.md) approves the local role matrix
and one-time owner bootstrap. [ADR 0017](adr/0017-cash-currencies-local-measures.md)
records the pilot's cash, currency, and local-weight requirements.
[ADR 0018](adr/0018-managed-pilot-hosting.md), amended 30 October, selects
Netlify Free/Neon Free for synthetic-data testing, defers paid production hosting,
and records the founder's budget, backup, recovery, and email-alert targets.
[ADR 0019](adr/0019-pilot-numeric-settlement-policy.md)
resolves the numeric-policy prerequisite and approves custom weights and recorded
mixed-currency cash settlement. Amended
[ADR 0009](adr/0009-specific-obligation-payment-allocation.md) requires
supplier-balance payment entry with oldest-first same-currency allocations.
G1 is accepted on retrospective founder evidence under ADR 0003's 1 November
amendment; task-specific checks and remaining deployment readiness stay open. The owning details are
tracked in [database](database.md), [security](security.md),
[API conventions](api-conventions.md), and [deployment](deployment.md).

## Intended boundaries

- Persistence code may be introduced under `src/db` only when persistence is needed.
- Authentication-provider integration must remain behind a small local auth module.
- `getSession()` returns `{ userId }` or `null`; `requireSession()` returns
  `{ userId }` or delegates denial to Clerk. Neither returns tokens, organization
  claims, or business permissions. New pages, actions, and handlers must invoke the
  guard before accessing protected data; a layout or proxy check is insufficient.
- Server code derives organization context from authenticated membership rather than
  request or form input. `src/auth/organizations.ts` verifies the authenticated
  active organization/user pair with Clerk's Backend API, including removal while
  a session has stale claims. Only identity fields leave the adapter.
- `getTenantContext()` in `src/db/tenant.ts` takes no arguments and returns
  `{ userId, organizationId, membershipId } | null`: the local organization UUID
  and Clerk membership identity. Missing session, active organization, current
  membership, or local mapping means no tenant. Service failures throw sanitized
  errors. Reads never provision, fall back to another organization, or cache
  membership across requests. Future business queries/mutations must call this
  boundary and enforce Task 10's local permissions. Staff management is implemented;
  purchasing/inventory/payment workflows remain placeholders.
- `requirePermission(permission)` in `src/db/authorization.ts` authenticates,
  verifies current tenant membership, reads only that organization/membership/user
  assignment, and checks the fixed catalogue in `src/auth/permissions.ts`. Missing
  tenancy/grants and forbidden actions use `notFound()`; service failures throw
  safe errors. Redirects/framework exceptions are preserved. No grants or tenant
  context are cached across requests. Each future protected data operation must
  call it itself and scope resources to the returned local organization UUID.
- UI mutations use Server Actions with the per-invocation authentication,
  validation, authorization, and safe-error contract in [API conventions](api-conventions.md).
  Task 09 alone has a first-organization bootstrap exception before a local tenant
  exists. ADR 0016 extends it only to atomically bootstrap the first local owner
  grant once; retries never restore a removed or changed role.
  `/onboarding` authenticates before reading saved setup. The app layout routes a
  missing active local tenant there; resource-level guards remain mandatory.
- Clerk Admin/Member roles are membership-management roles, not purchasing
  permissions. The fixed Task 10 roles bind grants to verified membership identity so rejoining cannot
  revive old privileges. There is no local membership mirror or webhook sync.
- `/settings/staff` reads staff behind `staff.read`. Its Server Action validates
  commands and uses `src/db/staff.ts` behind `staff.manage`. Each mutation locks
  the local organization row, then rechecks the actor's current Clerk membership
  and local role before resolving targets. Ownership changes require
  `ownership.manage`; demotion/removal counts only current membership-bound owners.
  Provider calls remain in `src/auth/staff.ts`. Invitations/manual additions grant
  no business role; an authorized owner/admin assigns one after membership exists.
- `/join` authenticates staff without requiring an existing business grant. It
  shows only their own account ID and Clerk memberships, and reuses organization
  activation. Selecting a business grants no permissions; protected data still
  requires a fresh local authorization check.
- Financial and inventory business events must be atomic when those modules are
  introduced.
- Domain arithmetic does not establish tenant authority, approve a receipt variance,
  prevent duplicate posting, or authorize debt reductions. Each owning service must
  enforce those checks and preserve agreed weight/price/rate snapshots transactionally.
