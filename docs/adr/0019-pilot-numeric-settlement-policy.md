# ADR 0019: Use gram-precise stock and recorded mixed-currency cash settlement

- **Date:** 2026-10-27
- **Status:** Accepted; allocation amended 30 October 2026

## Context

The founder completed the policy interview and asked to finish the questions.
Purchases can use local measures and prices quoted in a different weight unit;
suppliers can receive a mixture of whole AFN and PKR cash. These answers amend
ADR 0017's same-currency-only restriction and resolve its remaining numeric gate.
They do not establish research coverage, successful pilot phone sign-in, or a
working deployment/restore.

## Decision

### Weight and prices

- Use kilograms as the common stock unit, accurate to one gram (0.001 kg).
  Accept bags, maan, khorwar, kilograms, and fractional quantities. Preserve the
  pilot definitions in ADR 0017, including actual weight for each bag line.
- Allow business-owned custom measures with a name and a positive weight in kg,
  itself accurate to a whole gram. Keep their management under `catalog.manage`
  (owner/admin/manager). This is a weight catalogue, not arbitrary formulas or
  non-weight conversions. Changed definitions never alter existing transactions.
- Quantity and price measures can differ. Preserve both and their weight
  snapshots: two 10-maan bags priced at 100 AFN per maan cost 2,000 AFN.
  A changed custom measure or bag definition must never reprice accepted goods.
- Enter unit prices with at most two decimal places. Keep intermediate weight
  conversions and price ratios exact; do not round a derived price per kilogram.
  Reject entries whose exact converted stock weight requires sub-gram precision
  rather than rounding stock. Normal input validation and bounded values remain
  required when these primitives are implemented.
- Round each monetary purchase-line total half-up to two decimals, once. An exact
  halfway amount rounds away from zero: 62.785 becomes 62.79. Sum rounded lines
  for the purchase total. Do not round the aggregate of unrounded lines instead.
- For successive accepted receipts of a purchase line, recognize its rounded
  cumulative value at the approved price/weight snapshots, less the value already
  recognized for that line. Thus a 3 kg pack priced at 100 AFN, accepted in three
  1 kg receipts, creates 33.33, 33.34, and 33.33 AFN of supplier debt. Apply this
  per line before summing receipt payables; retries/concurrency cannot recognize
  the same cumulative quantity or value twice. Owner-approved quantity variances
  retain the agreed price under ADR 0006.

### Cash and exchange

- Each purchase/payable retains one currency, AFN or PKR; supplier balances stay
  separate by currency. Under amended ADR 0009, staff enter one supplier payment
  against one debt currency; the app allocates it oldest-first across that
  supplier's unpaid receipt payables in the same organization and currency.
- Allow a payment to contain whole, non-negative AFN and/or PKR cash amounts,
  with at least one positive amount. The person authorized to record payment
  enters the rate agreed with the supplier when conversion is needed.
- Quote rates only as **1 AFN = rate PKR**. Rates must be positive, with at most
  six decimal places. Preserve the entered rate and original cash amounts
  permanently; reject extra decimal places instead of silently rounding.
- Calculate the combined value exactly in the chosen debt currency, then round
  half-up to two decimals once before allocation. For an AFN debt, use
  `AFN cash + PKR cash / rate`; for a PKR debt, use
  `PKR cash + AFN cash * rate`. Keep exact ratios until this final rounding.
  Distribute that amount across the oldest unpaid receipts without further
  conversion or rounding; allocation rows must sum to the converted payment.
- Reuse `supplier_payments.record` (owner/admin/accountant). Reject zero-valued
  allocations and allocations exceeding the supplier's total outstanding balance
  in the chosen currency under ADR 0009; each row must also fit its payable;
  unapplied credit remains excluded. Record cash actually retained; do not
  silently reduce a recorded cash amount or discard an excess as rounding.

### Fractional balances

- Remaining debt stays outstanding unless the owner explicitly approves a cash
  rounding reduction with a reason and an audit record. For example, 62 AFN paid
  against 62.79 AFN leaves 0.79 AFN until that reduction is approved.
- Limit the sum of rounding reductions to **0.99 units of the payable's currency
  over its entire lifetime**, not per payment/request. Larger differences remain
  outstanding. Serialize/check this limit and the balance in the same transaction
  as the posting; retries cannot apply the reduction twice.
  A payment covering several payables never combines their caps into a supplier
  allowance or resets a previously used cap. Reductions remain explicit and
  payable-specific, even though normal payment entry selects only the supplier.
- Preserve original receipt/payable amounts and actual cash. Append a separate
  reduction with currency, amount, payable/payment reference, actor, reason, and
  timestamp. Derive the balance from recognized debt minus allocations and these
  reductions. A reduction is not a cash payment and is shown separately.
- Task 25 must introduce `supplier_payments.adjust_rounding`, granted only to
  owner, as a narrow extension to ADR 0016's fixed permission matrix. Other
  payment/catalogue permissions retain their existing roles. No existing guard
  or permission is repurposed to grant this authority.

## Consequences

Task 12's numeric-policy prerequisite is resolved; it follows Task 11 in delivery
order. Tasks 13–14, 18–21, and 25–28 must implement the snapshots, reconciliation,
currency conversion, and owner-only adjustment checks described here. Task 25
must record adjustment provenance when introduced; it cannot wait for Task 27.

This decision adds no code, schema, dependency, permission, or deployed resource
yet. Current onboarding remains AFN-only. G1 was separately accepted on
retrospective founder evidence on 1 November; Tasks 13 and 14 had limited
pre-research implementation exceptions in [ADR 0003](0003-helmand-pilot-workflow.md).
This changes none of the numeric or settlement rules above. Pilot
phone validation and deployment configuration/restore remain open; the
[30 October readiness record](../handoffs/pilot-readiness-decisions.md) adds a
founder-reported successful phone login and approved operating targets.

## Amendment — Supplier-balance payment entry (30 October 2026)

The founder approved supplier-level entry, automatic oldest-first allocation
within each debt currency, and overpayment rejection. Amended ADR 0009 replaces
the former single-payable rule. The exact conversion, one final half-up rounding,
cash provenance, and per-payable reduction rules above remain the numeric policy.
Task 12's pure helpers are unchanged; Task 25 must implement the allocation and
transaction invariants, and Task 26 must reconcile payments without double-counting.

## Links

- [Initial cash and local measures](0017-cash-currencies-local-measures.md)
- [Supplier-balance payment allocation](0009-specific-obligation-payment-allocation.md)
- [Business permissions](0016-local-business-authorization.md)
- [Receipt-based supplier debt](0012-receipt-supplier-payables.md)
- [Build plan](../agent-sized-build-plan.md)
- [Interview handoff](../handoffs/pilot-numeric-policy.md)
