# API conventions

## Confirmed baseline

- The first application mutation is `createFirstOrganization()` in
  `src/app/onboarding/actions.ts`. There are no API routes or external API contracts.
- The approved boundary for application UI mutations is Next.js Server Actions;
  see [ADR 0015](adr/0015-server-action-mutation-boundary.md), accepted 26 October 2026.

## Mutation contract

- Treat each action as a directly callable server entry point. Call the local
  `requireSession()` guard inside it; a page, layout, proxy, action ID, or hidden
  control does not authorize a mutation.
- Validate all untrusted input with Zod before side effects, including form fields
  and client-supplied resource or retry identifiers. Explicitly select permitted
  fields; schema validation alone does not establish resource ownership.
- For an existing tenant, call `requirePermission(permission)` inside the action's
  server operation. It authenticates and obtains `getTenantContext()` on each
  invocation. Scope resource reads/writes to its returned local organization UUID.
  The permission is a server-owned catalogue literal. Client-provided user, organization, membership,
  or role IDs never grant authority; Clerk Admin/Member roles are not business roles.
- Keep actions small, client components as interactive leaves, Clerk calls in
  `src/auth`, and database operations in `src/db`. Use server-only helpers rather
  than an internal HTTP API or a new action framework. Route Handlers require an
  approved external HTTP use case.
- Preserve Next.js's same-origin Server Action protections. Any deployment that
  needs an `allowedOrigins` override must approve its exact origins first.
- Calculate business totals on the server. Use a local database transaction for
  each all-or-nothing financial or inventory event. Define idempotency and
  concurrency behavior with the task introducing the mutation.
- Return minimal serializable UI results and safe validation/conflict messages.
  Unexpected failures must provide a safe error and a correlation identifier
  linked to a server diagnostic with operation and failure stage. Exclude secrets,
  raw form data, SQL, provider payloads, and personal data from those diagnostics
  and client errors; never return raw records or caught errors.
- Preserve framework control flow: keep `redirect()` outside error-catching
  blocks, or rethrow Next.js control-flow exceptions before sanitizing failures.
  Refresh/revalidate affected data and navigate only after confirmed success.

The first mutation must include the error/correlation behavior above. A general
logging platform, formal business audit trail, and rate limiting retain their
later build-plan scope.

## Task 09 bootstrap

First-organization onboarding cannot require an existing local tenant. Its sole
exception is an authenticated action that creates or resumes the caller's first
organization and its local provisioning:

- Derive the creator from `requireSession()`. Before local provisioning or recovery,
  verify through Clerk's Backend API that the remote organization was created by
  that user and that their creator membership is current. Treat any submitted
  organization/retry reference only as a lookup hint, never as authority.
- Define durable retry and concurrency behavior in Task 09. Duplicate submissions,
  ambiguous remote outcomes, and remote success followed by local failure must
  recover the same organization without duplicating it or adopting another user's
  organization. A pending button alone is insufficient.
- Keep local organization/settings writes atomic where needed. Clerk and PostgreSQL
  do not share a transaction; document the recovery path for each partial outcome.
  Make the organization active only after local provisioning succeeds.
- [ADR 0016](adr/0016-local-business-authorization.md) extends this exception only
  to bootstrap the initial local owner role once in the provisioning transaction.
  General business operations require their own permission check; tenant reads
  still never provision data or roles.

Task 09 must verify unauthenticated and mismatched-creator denial, invalid input,
duplicate/concurrent requests, partial-success recovery, sanitized failures with
correlation, and successful activation after local provisioning. Define its exact
input/result shapes and recovery mechanism during implementation.

### Implemented onboarding contract

`createFirstOrganization(previousState, formData)` ignores client state as
authority and explicitly validates `name` and `businessType` (trimmed, 1–100
characters), `timezone` (accepted by `Intl.DateTimeFormat`, at most 100 characters),
`baseCurrency` (`AFN`), and `locale` (`en-US` or `ps-AF`). Business type and timezone
have no inferred defaults; the language starts at the current approved UI locale.
Client user/organization/role/retry fields are not used.

The result is a discriminated union: `idle`; `invalid` with field names;
`conflict` when saved details differ; `denied` when creator authority fails;
`error` with a correlation UUID; or `success` with only the Clerk organization ID
needed by the activation control. No provider errors or local records are returned.

The server reserves one immutable `organization_onboarding` row per creator before
contacting Clerk. Its database-generated UUID determines the unique Clerk slug
`afcs-<UUID>` and private `afcsOnboardingId` marker. Clerk slug uniqueness and local
unique constraints arbitrate concurrent requests. Every attempt verifies Clerk's
`createdBy`, marker, and exact current membership; neither the marker nor slug is
authority alone. The verified remote ID is pinned before atomic local
organization/settings writes. A pinned ID can never be replaced by onboarding.
The provider adapter now returns only verified `{ userId, clerkOrganizationId,
membershipId }` to the server operation. These IDs are never accepted from the form.

`completeOnboarding(request, membership)` locks the saved request and returns
`true` after local completion or `false` for a missing/mismatched saved request or
membership. The transaction creates settings/mapping and, only when the durable
`owner_membership_id` is absent, the first owner assignment and marker. A retry
with the same membership preserves any later downgrade/deletion; another membership
is denied. Database failures roll everything back. The action exposes no activation
data after a `false` result.

- Before reservation or after a confirmed failed remote creation: retry the same
  details. No local business exists yet, and the reserved slug stays the same.
- An ambiguous remote result or remote success before the pin: look up the same
  slug, reverify creator membership, and pin the existing organization.
- A local write failure: retain the pinned remote ID and retry its local transaction;
  never delete the remote organization as compensation.
- A retry after completion: reverify membership and confirm the existing settings;
  do not overwrite them. Changed details return `conflict` with reload guidance.
- A removed creator membership or deleted pinned organization: deny recovery and
  retain local history. Do not silently create a replacement.
- Activation failure: the business remains saved. Retry **Open workspace** or
  return to onboarding; activation never reruns organization creation itself.

`OrganizationActivation` calls Clerk `setActive` only after `success`, then performs
a full navigation to `/dashboard`. Dynamic tenant reads therefore use fresh
membership and local data. Subsequent page/data access requires the local business
permission separately; activation alone grants none. Reserved
slugs must remain unchanged until their remote IDs are pinned; see the
[operational prerequisite](deployment.md#onboarding-recovery-slugs).

## Staff management contract

`updateStaff(previousState, formData)` authenticates and explicitly selects
`operation`, `emailAddress`, `userId`, `membershipId`, `role`, and `invitationId`.
Client state and organization/actor IDs never establish authority. The server-only
`manageStaff(input)` operation independently requires `staff.manage`, validates a
Zod discriminated command, and derives the organization from the verified tenant.

- `invite`: valid email, at most 254 characters; Clerk `org:member`, 30-day expiry.
  Repeated submissions reuse an existing live pending invitation. It grants no
  local role. After an ambiguous result, reload pending invitations before retrying.
- `add`: an existing Clerk `user_` account ID, at most 200 characters. Repeated or
  ambiguous creates resolve the exact current organization/user membership. No
  notification or local role is created.
- `role`: current membership ID and one of the seven fixed roles. Both old/new
  ownership require `ownership.manage`; never demote the last active owner.
- `deactivate`: current membership ID. Remove membership through Clerk, retaining
  its historical local grant. Removing an owner requires `ownership.manage` and
  another currently verified owner. Rejoining never revives an old grant.
- `revoke`: a pending invitation ID verified inside the current organization.

Resource IDs are trimmed, nonempty, and at most 200 characters. Role writes are
parameterized and bound to local organization, current membership, and current
user. Every mutation takes the same organization row lock and rechecks actor and
target after waiting. Results are `success`, `invalid` with field names,
`conflict`, `owner-required`, `last-owner`, or a safe `error` with correlation ID;
Next.js authentication/authorization control flow is preserved. Success
revalidates `/settings/staff`. See the [recovery procedures](handoffs/11-staff-management.md#expiry-and-recovery).

## Units and categories contract

`updateCatalog(previousState, formData)` authenticates and forwards only operation,
resource ID, name, and unit details. `manageCatalog(input)` independently requires
`catalog.manage`, validates the discriminated Zod command, derives the tenant,
locks the organization row shared with staff mutations, and rechecks fresh Clerk
membership and the exact local grant before writing.

- `seed-units`: explicitly add approved kg/maan/khorwar definitions and bags without
  changing existing weights or inactive entries; no category defaults.
- `create-unit` / `update-unit`: trimmed 1–80 character name and either fixed weight
  (positive kg, at most 18 integer/three fractional digits) or variable bag weight
  (`null` in the catalogue). Update requires a local UUID and an active tenant row.
- `create-category` / `update-category`: trimmed 1–80 character name; update requires
  a local UUID and an active tenant row.
- `deactivate-unit` / `deactivate-category`: local UUID; mark an active tenant row
  inactive without deletion or historical changes. Repeating returns `conflict`.

Names are unique per tenant/table ignoring case and surrounding spaces, including
inactive names. Results are `success`, `invalid` with field names, `duplicate`,
`conflict`, or a safe `error` with a correlation UUID. Framework authentication
and permission control flow is rethrown. Only success revalidates `/settings/catalog`
and the product list/detail pages that display these units/categories. The
units/categories action accepts only its own operation names.
After an ambiguous result, reload the list before retrying; normal duplicate
creates never create a second same-name row. Edits currently use last successful
write semantics; there is no version-conflict editor in this task.

`getCatalogWorkspace()` requires `catalog.read`, returns tenant-scoped scalar
lists with a current `canManage` flag, and never writes. `getUnitSnapshot(input)`
requires `catalog.read` and an active unit UUID. It returns scalar quantity/measure
snapshots and exact normalized kg; bags require a positive gram-precise actual
weight, while fixed-weight overrides and sub-gram stock are rejected. Like Task
12, the calculation accepts zero quantity; future posting services must enforce
their positive quantities and persist snapshots atomically with the business event.

## Product catalogue contract

`/products` uses the same catalogue service and permissions. `updateProduct`
authenticates and forwards only product fields to `manageCatalog`; unrelated
operation names are rejected. Only successful mutations revalidate `/products`
and the `/products/[id]` page pattern. Safe errors and ambiguous-result recovery
follow the catalogue contract above.

- `create-product`: trimmed 1–80 character name, optional code/SKU up to 40
  characters (blank becomes null), optional category UUID/null, required unit UUID.
- `update-product`: those fields plus an active product UUID in the current tenant.
- `deactivate-product`: active tenant product UUID; no deletion or reactivation.

Create/edit requires active unit/category references in the server-derived tenant.
Name/code conflicts include inactive products. Updates use last successful write
semantics. `getProducts()` and `getProduct(id)` require `catalog.read`, scope reads
and joins to the current tenant, and return scalar details including inactive
records. Malformed, missing, and foreign detail IDs return the same not-found
control flow. Reads never seed data. Future transaction selectors must check active
products/units; this general catalogue list does not establish posting eligibility.

## Supplier directory contract

`/suppliers` and `/suppliers/[id]` use `getSuppliersWorkspace()` and
`getSupplier(id)` under `suppliers.read`. Reads return only tenant-scoped scalar
contact details; missing, malformed, and foreign IDs share not-found behavior.
`updateSupplier` authenticates and forwards only supplier fields to
`manageSupplier` under `suppliers.manage`; it accepts only `create-supplier`,
`update-supplier`, and `deactivate-supplier`. Caller tenant, role, and balance
fields are ignored. The shared organization lock precedes fresh provider identity
and local grant checks on the transaction connection.

Create/edit uses [ADR 0021's contact limits](adr/0021-supplier-contact-records.md).
Optional Radix type `unspecified` becomes null; unsupported types are rejected.
Inactive rows remain readable but cannot be edited or revived. Duplicate display
names include inactive rows. Outcomes follow the catalogue's `invalid`,
`duplicate`, `conflict`, `success`, and safe correlated `error` contract. Only
success refreshes supplier list/detail pages; ambiguous outcomes require reloading
the directory before retrying. Descriptive terms establish no debt or due date.

## Decision status

**Accepted — G4 mutation boundary:** [ADR 0015](adr/0015-server-action-mutation-boundary.md).
Tasks 09–11 follow ADRs 0014–0016. ADR 0019 resolves numeric policy, and ADR 0021
records Task 15 supplier contacts. G1 was accepted on 1 November; pilot sign-in
validation and deployment gates remain open in the
[build plan](agent-sized-build-plan.md#current-gate-status).
