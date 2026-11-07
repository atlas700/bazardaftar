# Security

## Confirmed requirements

- Tenant isolation is enforced server-side from authenticated organization membership.
- Hiding a UI control is not authorization; protected queries and mutations require
  server-side permission checks.
- Untrusted server input requires validation.
- Secrets must not be exposed through `NEXT_PUBLIC_*` variables or committed to the
  repository.
- User-facing errors must not expose stack traces, SQL, secrets, or personal data.

Task 30's [failure diagnostics contract](api-conventions.md#failure-diagnostics-contract)
defines safe action/render references and redacted JSON events. Operators view
server stderr; the [log operations and redaction guide](handoffs/30-safe-diagnostics.md#log-operations-and-redaction)
defines included fields, excluded private data, lookup steps and deployment limits.

## Decision status

**Decided — G4 authentication:** Clerk is the approved managed identity and secure
session provider for Task 06; see [ADR 0002](adr/0002-clerk-authentication.md). On
30 October the founder confirmed a preference for phone codes and reported a
successful delivery and login test; its date/context and Pilot A–C/deployed-environment
validation remain open. Under
[ADR 0014](adr/0014-clerk-organizations-local-business-roles.md), Clerk owns
membership and the application will own business permissions. Neither a
client-controlled organization ID nor Clerk Admin/Member roles grant business access.

Task 06 uses Clerk's SDK-managed sessions, per-page server guards, and an explicit
`authorizedParties` origin. Authentication returns an external user identity only;
the separate Task 08 adapter verifies current active-organization membership against
Clerk's Backend API before resolving a local organization UUID. Missing/deleted or
mismatched membership and absent local mappings deny tenant access; outages throw
sanitized errors without exposing provider details, SQL, or credentials. Membership
is rechecked on every lookup, not cached across requests or mirrored by webhooks.
`requirePermission()` now checks the fixed ADR 0016 matrix and the exact local
organization/membership/user assignment on every call. Existing pages use it;
future data operations and mutations must call it themselves. Denials return the
framework's missing-resource response; outages throw sanitized errors. No role is
inferred from Clerk Admin/Member, and unknown roles/permissions deny access.
Task 09 validates its authenticated bootstrap action with Zod, verifies remote
creator identity and current membership, and provisions only that creator's saved
request. Client tenant/role IDs and previous action state never grant authority.
Creation retries use one durable request and a unique Clerk slug; recovery does
not restore removed memberships. Under ADR 0016, successful provisioning also
records the initial owner membership and its local grant atomically, once. The
durable marker prevents retries from restoring a changed/deleted grant or giving
it to a rejoined membership. Only confirmed
local provisioning exposes the activation control. Failure diagnostics contain
operation, stage, and correlation UUID, without raw inputs, errors, SQL, or PII.
The Clerk publishable
key may use `NEXT_PUBLIC_`; its secret key must never do so. Missing or malformed
configuration fails without echoing credential values.

**Decided — G4 role matrix:** the founder approved
[ADR 0016](adr/0016-local-business-authorization.md) on 27 October: seven fixed local
roles, an explicit action matrix, membership-bound assignments, one-time owner
bootstrap, and a server-only guard. Task 10 implements this policy. G1 is accepted
on retrospective founder evidence under ADR 0003's 1 November amendment; remaining
operational gates stay open. G1 acceptance changes no permission or security boundary.

[ADR 0019](adr/0019-pilot-numeric-settlement-policy.md) approves the fixed
`supplier_payments.adjust_rounding` permission for owner only. Task 25 enforces
the lifetime 0.99 debt-currency cap per payable atomically, retaining
actor/reason/provenance. Supplier-level payment entry does not pool or reset caps.
Payment and reduction writes lock the organization, then recheck current provider
membership and the local grant on the transaction connection, including on replay.
Tenant/supplier/currency foreign keys bind cash, allocations and separate reductions.
Task 26 account reads require `supplier_balances.read`, recheck current provider
identity and the local membership-bound grant inside their read transaction, and
bind all statement sources/cursor anchors to the verified tenant and supplier.
Warehouse/sales roles receive no financial account access. Historical payment
deep links retain `supplier_payments.read` and tenant/supplier/currency validation.
Custom weight management
and payment/rate entry reuse existing `catalog.manage` and
`supplier_payments.record`; neither permits debt reductions.

**Partially resolved — G4 operational security:** the founder owns operations and
backup recovery under amended [ADR 0018](adr/0018-managed-pilot-hosting.md).
Approved targets are 30-day database backups, at most one hour of lost entries,
four-hour recovery during business hours, and email alerts to the founder.
Overseas storage is allowed; exact provider/region/destination, access, log
retention, and incident procedures still need definition. Verify alert delivery
and a non-production restore before pilot use. Temporary free testing uses
synthetic business records and grants no permission to expose production data.

## Staff management

Task 11 enforces staff permissions in the server operation, including a fresh
membership/local-role check after acquiring the organization row lock. Admins
cannot grant, demote, or remove owners. Only current, exactly matched memberships
count toward the last-active-owner invariant; remote removal denies stale-session
access and rejoining requires an explicit new grant. Bootstrap markers are never
reset. Invitations and manual additions create no business grants. Invitation
URLs/metadata are excluded from staff list responses and diagnostics.

The lock serializes application staff operations across server processes; Clerk
does not participate in a PostgreSQL transaction. Direct Clerk Dashboard edits,
self-service departures, and provider-side account deletion can bypass the app's
last-owner check. Use the app for ownership changes; reconcile external changes
without resetting grants or bootstrap markers. No automated owner recovery or
Clerk Admin promotion is introduced. See [Task 11 recovery](handoffs/11-staff-management.md#expiry-and-recovery).

## Request abuse controls

Task 31 uses PostgreSQL-backed fixed-window admission across application
instances. The [request contract](api-conventions.md#request-admission-contract)
defines methods, scope, limits and safe responses. Only verified Clerk identity
selects a signed-in user's bucket. Tenant/permission checks, Next.js origin/body
limits, transaction rechecks and durable financial fingerprints stay authoritative.
No per-process map or caller-provided identity is used.

Anonymous authentication and unsigned mutations use separate shared budgets.
This is a coarse one-business-pilot safeguard: one client can consume anonymous
capacity for others. There is no trusted client-IP boundary configured in this
repository, so forwarding headers are deliberately ignored. Before broader use,
Task 34 must verify the deployed adapter's client-IP/proxy trust boundary and
appropriate provider/edge controls. Requests made directly to Clerk's domain stay
under Clerk's controls; this app only limits its own sign-in/Frontend API paths.
Clerk proxy GETs for assets/session reads remain outside these counters.

`request_rate_limits` contains scope, HMAC key, bounded hits and UTC reset time.
The existing server-only Clerk secret keys the versioned HMAC; rotating that
secret resets effective admission identities. Counters commit before business
work and are not business audit records. Each request resets its expired row and
cleans at most 100 other rows expired for more than a day, using the expiry index
and `SKIP LOCKED`. When idle, stale rows remain until traffic resumes; privileged
maintenance can remove expired rows without touching business/audit history.

The counter transaction sets a two-second statement timeout and 500ms lock timeout;
connection acquisition/availability still depends on the configured PostgreSQL
pool/provider. Counter failures fail closed with redacted `request_limit_failed`
diagnostics. Ordinary 429s produce no failure-log flood. Fixed windows permit
boundary bursts, and every attempted limited request still reaches PostgreSQL;
this is not volumetric DDoS protection or a provider spending cap. Deployed Node.js
proxy/pg compatibility, quotas, spend controls and live acceptance remain Task 34
evidence. Apply migration `0017_request_rate_limits.sql` before deploying the app.

## Mutation safeguards

The first mutation must meet the safe error and correlation requirements in the
[mutation contract](api-conventions.md#mutation-contract), approved by
[ADR 0015](adr/0015-server-action-mutation-boundary.md). General access-request
logging remains outside this feature.

## Business audit trail

Task 27's server-only writer persists the verified organization, user and membership,
source entity/action, UTC occurrence time, request UUID, outcome and bounded summary
snapshots. Local staff grants, onboarding, master data, purchase lifecycle,
receipts/payables, adjustments, payments and rounding reductions require audit
inserts in their own mutation transaction. Failures roll back local changes.
Financial/stock replays and seed/role/provider no-ops append no duplicate completion.
Existing records are not backfilled with invented historical actors or events.

Snapshots use a per-entity allowlist of operational IDs, states, exact decimal
strings, catalogue/product/warehouse names and bounded counts. Supplier names,
phones, locations, email addresses, identifiers for display, free-text notes,
payment terms, reasons/references, sessions, tokens, passwords and nested payloads
are excluded. Changes to private fields retain field names, not private values.
Approval reasons remain in their permission-protected source records. Audit IDs
and actor identities are still sensitive tenant data.

**Access:** `audit.read` remains limited to owner, admin and accountant under
ADR 0016. No application audit reader, route, export or browser payload is exposed
by this task. Any later reader must check current provider membership and that local
grant, scope every query/cursor to the verified organization and return safe fields.
Until then, founder-controlled database inspection is an operational procedure;
never give staff database credentials as a substitute for authorization.

**Retention:** retain pilot audit entries without automatic expiry. There is no
application edit/delete/purge command. An approved retention/archive and access
procedure is required before any future removal; the 30-day backup target is not
an audit deletion policy. General diagnostic-log retention remains an open
operational decision. Restore and privileged maintenance remain founder-controlled.

`0016_append_only_audit.sql` rejects UPDATE, DELETE and TRUNCATE and grants none
of those operations to PUBLIC. This protects ordinary writes, not against a database
owner/superuser who can disable triggers or change schema. Task 34 must provision
an appropriately restricted runtime role separately from migration/maintenance
authority. The test-only cleanup helper verifies the isolated database and tracked
synthetic tenants, exclusively locks the table and restores its trigger in the
same transaction; it has no application caller.

**Staff provider boundary:** commit request evidence immediately before each
validated Clerk side effect, then commit completion evidence after provider success.
Staff uses `FOR NO KEY UPDATE`: it still serializes every app mutation but permits
the independent intent insert's tenant foreign-key check. An unmatched request can
mean provider failure, an ambiguous timeout, a process interruption, or remote
success followed by local rollback. Reconcile its tenant/action/target/time and
correlation UUID against Clerk before retrying; never relabel or delete history.
For an invitation whose creation response was lost, the request targets the
organization; reconciliation may require its protected provider invitation list.
The completion records the returned invitation ID. No automatic reconciliation,
provider webhook ingestion or audit of direct Clerk Dashboard changes is claimed.

## Dependency advisories

Production dependencies must pass the high/critical audit gate described in
[Testing](testing.md#dependency-gate) before deployment. There are currently no
approved advisory exceptions. Record any future owner-approved exception here with
its advisory ID, affected path/reachability, mitigation, owner, and expiry/review date.

### Development-tooling advisory tracked on 20 October 2026

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
affects `braces` through 3.0.3; the advisory lists no patched release. The installed
path is `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch →
braces`. The full audit reports five high entries for this one development-only
dependency chain; `npm ls braces --omit=dev` confirms it is absent from the
production dependency tree.

The failure case is a deeply nested, attacker-controlled brace pattern exhausting
the parser's call stack. The current lint command uses the fixed `src` path;
application requests do not supply patterns to this tooling. Keep lint patterns
repository-controlled and review untrusted lint configuration before execution.
The repository owner must recheck this advisory on the next dependency update or
before accepting externally supplied patterns. Track a compatible upstream fix;
the audit's suggested downgrade to `eslint-config-next` 14 is incompatible with
this project's Next.js 16 lint stack. This is tracked development-tooling exposure,
not an exception to the production audit gate.

### Development-tooling audit update — 25 October 2026

Task 07's production audit reports zero vulnerabilities. The full audit now
reports four moderate entries from
`drizzle-kit → @esbuild-kit/esm-loader → @esbuild-kit/core-utils → esbuild`
([GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)).
The affected esbuild version is 0.18.20; the advisory concerns its development
HTTP server. This project uses Drizzle Kit only for local generation/migration,
not an esbuild HTTP server or exposed Drizzle Studio. It is absent from production
dependencies. Recheck on the next tooling update; the audit's proposed Drizzle Kit
0.18.1 downgrade would replace the current migration tooling and is not applied.

The existing ESLint dependency's Zod was updated from 4.6.5 to 4.6.7 to resolve
[GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
No high/critical entries remain in the full audit. The older `braces` entry above
is a historical report; the current audit does not report it. The production gate
and its no-exceptions policy are unchanged.
