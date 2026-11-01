# ADR 0021 — Supplier contact records

- Status: Accepted
- Date: 1 November 2026

## Context

The founder authorized Task 15 after G1 acceptance and explicitly selected
“Individual or business” for supplier types. Purchasing needs identifiable,
business-owned counterparties before orders, receipts, or payments are implemented.

## Decision

- Store supplier name, optional phone, location, type, notes, descriptive payment
  terms, and active state. Type is `individual`, `business`, or null when unspecified;
  it changes no authorization or financial behavior.
- Use a trimmed display name of 1–80 characters, unique per business ignoring
  case, including inactive suppliers. Distinguish same-name contacts in their
  display names. Phone is optional contact text, supports local digits and usual
  punctuation, and is neither unique nor an authentication credential.
- Bound phone/location/notes/payment terms to 40/200/2000/500 characters.
  Empty optional text becomes null. Terms describe agreements; this task does not
  calculate due dates, enforce credit, or create any financial obligation.
- Reuse `suppliers.read` and `suppliers.manage` under ADR 0016. Derive tenant and
  actor from verified Clerk membership and local grants. Recheck both after the
  organization lock shared with staff management.
- Deactivate without deletion or reactivation, retaining readable contact records.
  Edits require active tenant records and use last successful write semantics.
- Use ADR 0020's shared UI, system fonts, tokens, Lucide icons, and Radix Select,
  with native Server Actions, Zod validation, retained values, and RTL support.

## Consequences

No mutable balance, currency default, opening debt, payment allocation, enforced
credit terms, or due-date policy is introduced. Future purchase/receipt services
must validate supplier ownership and active state in their own transactions;
contact classification does not establish posting eligibility. The pilot directory
is read in full; pagination remains deferred until its size requires it.

Task 16 remains deferred. Task 17 — one warehouse — is next under the existing
pilot order. Sign-in, terminology, deployment, and restore gates remain open.

## Links

- [Build plan](../agent-sized-build-plan.md)
- [G1 acceptance](0003-helmand-pilot-workflow.md)
- [Business authorization](0016-local-business-authorization.md)
- [Workspace design system](0020-workspace-design-system.md)
- [Task 15 handoff](../handoffs/15-suppliers.md)
