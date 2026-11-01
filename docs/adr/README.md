# Architecture decision records

Use an ADR for a durable product or engineering decision that changes the system's
behavior, data, security posture, or operating model.

## Statuses

- **Proposed:** awaiting the required evidence or approval.
- **Accepted:** approved and safe for implementation.
- **Superseded:** replaced by a newer ADR that links back to it.
- **Rejected:** considered and not adopted; retain the reason.

## Format

Create numbered files as `NNNN-short-title.md` with: title, date, status, context,
decision, consequences, and links to related tasks or ADRs. A proposed ADR must
clearly distinguish evidence from assumptions.

## Current state

[ADR 0001](0001-launch-localization.md) and
[ADR 0002](0002-clerk-authentication.md) record the accepted localization and pilot
authentication decisions. [ADR 0003](0003-helmand-pilot-workflow.md) records the
pilot workflow, the 28 October grain/mixed-goods market amendment, and the
1 November acceptance of retrospective G1 research in place of the original
individually recorded evidence prerequisite. [ADR 0004](0004-single-stock-unit.md) records
the pilot's single-stock-unit policy. [ADR 0005](0005-product-stock-identity.md)
records the pilot's product-identity policy. [ADR 0006](0006-receipt-variance-approval.md)
records the pilot's receipt-variance approval policy. [ADR 0007](0007-no-negative-stock.md)
records the no-negative-stock policy. [ADR 0008](0008-dispatch-stock-timing.md)
records the conditional dispatch stock-timing policy. [ADR 0009](0009-specific-obligation-payment-allocation.md)
records the 30 October supplier-balance entry and automatic oldest-first
same-currency payment allocation policy, replacing manual single-payable selection.
[ADR 0010](0010-owner-approval-for-corrections.md)
records the corrections-approval policy. [ADR 0011](0011-validate-purchase-receipt-terminology.md)
records the terminology-validation scope. [ADR 0012](0012-receipt-supplier-payables.md)
records receipt-based supplier debt recognition. [ADR 0013](0013-local-postgresql-foundation.md)
records local PostgreSQL, the structural ownership model, and reviewed migration
and recovery policy. [ADR 0014](0014-clerk-organizations-local-business-roles.md)
replaces local membership ownership with Clerk organizations and memberships,
retaining local business-data ownership and later business roles.
[ADR 0015](0015-server-action-mutation-boundary.md) approves Server Actions for UI
mutations, the required server checks and observability, and Task 09's narrow
first-organization bootstrap exception.
[ADR 0016](0016-local-business-authorization.md) approves Task 10's fixed business
roles, permission matrix, first-owner bootstrap, and authorization guard. It is
accepted on 27 October and closes the G4 permission-policy gate.
[ADR 0017](0017-cash-currencies-local-measures.md) records cash-only payments,
separate AFN/PKR balances, and local weight entry, amending ADR 0004.
[ADR 0018](0018-managed-pilot-hosting.md), amended 30 October, selects Netlify
Free/Neon Free for synthetic-data testing, defers paid production hosting, and
records the founder's spending ceiling, backup/recovery targets, overseas storage
permission, and email alerts. [ADR 0019](0019-pilot-numeric-settlement-policy.md) completes the
numeric policy, introduces custom weight measures and recorded mixed-currency
settlement, and approves a future owner-only cash rounding reduction permission.
The [30 October readiness record](../handoffs/pilot-readiness-decisions.md) captures
50 reported interviewees, approximately 50 observed businesses without original
notes, and a reported successful phone-code login. G1 was accepted by the founder
on 1 November with the missing original audit trail explicitly retained as a
limitation. Remaining pilot authentication validation, terminology review, and
deployment readiness stay open.
The [build plan's gate status](../agent-sized-build-plan.md#current-gate-status)
is the task-readiness record. G1 now has founder acceptance; remaining G4 decisions
and verification stay open. Record each decision before starting
a task that depends on it.
