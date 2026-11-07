# Task 30 — Safe errors and correlated server diagnostics

Date: 7 November 2026. Acceptance and local verification complete; ready for PR review.
Source: [Task 30](../agent-sized-build-plan.md#30--add-user-facing-errors-request-ids-and-structured-server-logs),
[mutation contract](../api-conventions.md#failure-diagnostics-contract),
[ADR 0020](../adr/0020-workspace-design-system.md).

Pilot users can supply a safe support reference when an operation or screen fails.
The server records a matching diagnostic without transaction contents or private
exception text. This task introduces no dependency, migration, environment variable,
business mutation, deployment, rate limiter or business-audit reader.

## Completed acceptance

- All existing mutation actions use shared server-only `actionFailure()` and retain
  `{ status: "error", correlationId }`. Existing validation/conflict states, exact
  calculations, authority checks, transactions, retry identities and recovery copy
  remain in their owning modules. Redirects and permission denials are rethrown
  before sanitizing/logging; invalid input produces no noisy exception event.
- Clerk's locale callback replaces the incoming `x-bazardaftar-request-id` with a
  server UUID and GT forwards it through Next's request-header overrides. The same
  ID is returned in the response and action-failure state. Tests use real GT
  composition with mocked Clerk and verify action headers, locale and body survive.
  This ID carries no authority and never replaces financial idempotency UUIDs.
- Auth/database readers retain a safe message and only an allowlisted failure
  category when replacing a raw error. They retain no raw cause. Categories survive
  nested sanitization without a global mutable request store.
- Next's server `onRequestError` hook records uncaught render/action/route/proxy
  failures. Route boundaries show only validated numeric Next digests, with LTR
  isolation inside RTL layouts. They never render error messages or stacks.
  Digestless/client errors retain retry without inventing a server reference.
- The standalone `global-error.tsx` supplies its own document, styles and retry
  button without auth or translation providers. It uses English/LTR as a last-resort
  fallback when the normal locale provider cannot render; normal route errors keep
  GT localization. Current translation-service/terminology limits remain open.
- Background database pool errors use the same redacted JSON format with a fresh
  UUID. Successful requests and routine validation/denial outcomes are not logged.

## Log operations and redaction

Application diagnostics are one JSON object per `console.error` line on the Node
server's stderr. Locally, view them in the terminal running `npm run dev` or
`npm run start`, or the operator's captured process stderr. A future host's function
or server logs must capture that stream; no hosted log viewer, retention policy,
alerting or external error-monitoring service is configured by this task.

The only emitted fields are UTC `timestamp`, `level`, a server-owned `event` and
`stage`, `correlationId`, `failureKind`, and an optional validated numeric `digest`.
Failure kinds are database, connectivity, timeout, provider or unknown. Classification
examines bounded nested causes and retains the category only; it never emits the
original database/provider code. Unknown errors remain unknown.

For a failed mutation, search stderr for the exact correlation UUID shown to the
user. For a failed page, search `server_request_failed` for the shown numeric
digest, then use the UTC occurrence and logged request UUID to identify the event.
The same digest may recur across requests; it is not a unique transaction ID.
Missing request context and background errors receive fresh UUIDs. Clerk middleware
redirects before its locale callback may have no response UUID; captured unexpected
failures still receive a diagnostic fallback ID.

Logs omit raw exceptions, stacks, SQL, connection strings, credentials, cookies,
authorization headers, request headers/URLs/query strings, form/provider payloads,
user/organization/contact identities, amounts, notes and reasons. No arbitrary
metadata object is spread into a diagnostic. Framework/provider/hosting output is
outside this application allowlist and needs restricted operator access and review
when deployment is configured. Client-only exception collection is not added.
These diagnostics do not replace Task 27's transactional business audit trail.

## Changed files

- `src/diagnostics/failure.ts`, `server.ts`, `server.test.ts`: safe state/reference
  contract, category retention, JSON logger and action failure handling.
- `src/instrumentation.ts`, `.test.ts`, `src/auth/middleware.ts`, `.test.ts`:
  server-error capture and request correlation through the existing locale flow.
- `src/auth/server.ts`, `.test.ts`, `organizations.ts`: sanitized unexpected
  provider failures with unchanged framework denial behavior.
- `src/db/index.ts`, `.test.ts`: safe structured background pool failures.
- Sanitizing catches in `src/db/authorization.ts`, `tenant.ts`, `workspace.ts`,
  `catalog.ts`, `suppliers.ts`, `warehouses.ts`, `staff.ts`, `purchases.ts`,
  `receipts.ts`, `inventory.ts`, `inventory-adjustments.ts`, `supplier-payments.ts`,
  `supplier-statements.ts`, `dashboard.ts`: retain safe failure categories only.
- Existing actions under onboarding, products, suppliers, purchases/receipts,
  inventory adjustments, payments, settings/catalog, staff and warehouse, plus
  affected action tests. Remove onboarding's duplicate `_lib/failure.ts`; its
  saved-setup page now uses the instrumented render boundary.
- `src/components/feedback.tsx`, `.test.tsx`, all existing route `error.tsx` files,
  `src/app/global-error.tsx`, `.test.tsx`, onboarding/join pages and their tests,
  and `src/app/recovery.test.tsx`: safe references and retained recovery actions.
- Build plan, documentation index, API conventions, architecture, testing,
  security guidance and this handoff: contracts, navigation, evidence and next task.

## Pre-validation review

Applied Ponytail review to the complete diff and connected callers/tests, including
input selection, authentication/permission control flow, tenant authority, request
header forwarding, output redaction, nested cause bounds, transaction boundaries,
root-provider independence and retry callbacks. A bounded read-only GPT-6 Luna
review found no concrete must-fix findings. Main-agent review found one membership
adapter still dropping the safe provider category; changed its generic error to
`safeServerError()`, rechecked the catch and included it in final checks. No unresolved
must-fix findings. No business SQL, schema, authorization grant or transaction
semantics changed.

## Verification

- Baseline: lint, typecheck, 808 database-free tests and build passed before edits.
- Test-first: the first four diagnostic suites failed on missing server/hook
  modules, missing middleware ID and absent feedback reference. They then passed.
  Auth-provider sanitization and standalone root recovery also demonstrated RED
  before implementation and GREEN afterward. Checkpoints: `0bda152` (initial RED)
  and `7b59ad4` (GREEN implementation); this handoff preserves subsequent RED/GREEN
  evidence as well. No quantitative coverage tool was installed or claimed.
- Final `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` passed.
  Database-free run: 66 suites/833 tests passed; 263 PostgreSQL cases explicitly
  skipped there. Separate local PostgreSQL verification passed all 14 suites/263
  tests against `afcs_task07_verify` only, with synthetic tracked tenant fixtures.
  The existing local runner loads credentials without printing them and refuses
  nonlocal database hosts. No application database was used for test writes.
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities. Diff and focused
  logging/secret/type-escape checks passed.
- Actual-component local fixtures passed 48 viewport cases at 1440x900, 390x844
  and 320x900 across root, dashboard, onboarding and standalone recovery, safe
  reference present/absent and LTR/RTL containers. No overflow, text-fit or 44px
  button-target failures. Global fallback owns its English/LTR document. Actual
  dashboard error retry works with keyboard Enter and visible focus; no page errors.
  Desktop root, phone global fallback and narrow RTL references were visually
  inspected. Ignored artifacts live under `artifacts/task30-diagnostics/`.
- Applied Taste, UI/UX Pro Max, frontend direction and accessibility guidance to
  this focused existing-system edit. No new visual direction or style draw was
  needed. Taste source lint: zero failures, one existing loading-pulse warning.
  Render inspection: zero failures, three explained warnings for the existing
  root screen's deliberately capped recovery column, empty space and heading size.
  The frontend design evidence checker passed. No data/chart imagery applies.

## Limitations and next task

Remote CI/review and live Clerk, translated Pashto, production error propagation,
deployed log capture/retention and pilot incident recovery are separate evidence;
the local fixtures and mocked providers establish none of them. No hosted log
service, client-error upload endpoint or full provider-backed browser suite was
added. No pilot release gate is closed by this task.

**Next task: 31 — rate limits and mutation abuse controls.** Reports/CSV (Task 29)
and Tasks 16/23–24 remain deferred in the approved pilot delivery order.
