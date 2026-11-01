# Product requirements

## Confirmed baseline

- The first paid product is a multi-tenant operating system for one type of
  agricultural wholesaler or distributor in one Afghan city or province.
- The approved pilot workflow is: purchase, accept receipt, track stock and supplier
  debt, record supplier payment, and reconcile supplier balances. Sales and customer
  payments remain deferred under ADR 0003.
- Features outside that workflow remain deferred unless pilot evidence makes them
  necessary.

## Decision status

**Decided — G0 initial market:** target Helmand grain and mixed-goods wholesalers
under ADR 0003's founder-approved amendment of 28 October, replacing the initial
fruit-and-nut segment. Launch Pashto-first with English for internal and
administrative use. The expected pilot contacts are recorded only as Pilot A (owner), Pilot B
(warehouse/operations), and Pilot C (sales/accounts). See
[ADR 0003](adr/0003-helmand-pilot-workflow.md).

**Accepted — G1 retrospective workflow research (1 November):** the founder
accepted the reported 50 interviewees, approximately 50 observed businesses,
reconfirmed common workflow, and reconstructed B001 example, requesting completion
without repeated business interviews. The [ADR 0003 amendment](adr/0003-helmand-pilot-workflow.md#amendment--founder-acceptance-of-retrospective-g1-research-1-november-2026)
replaces the original 20-individually-recorded-interview/five-observation prerequisite.
That original checklist remains unverified; reported totals do not become mapped
records. See the [evidence register](handoffs/g1-evidence-register.md) for B001's
eight workflow topics, approximate amounts, grouped worker answers, and unknowns.

**Decided — G2 pilot workflow:** validate purchase-to-receipt first to improve stock
accuracy and supplier balance visibility. The pains, four-week success metric, and
explicit exclusions are in [ADR 0003](adr/0003-helmand-pilot-workflow.md). G1 is
accepted on retrospective founder evidence; this is not proof of live software
use, retention, or correctness of every unobserved edge case.

**Decided — G3 units:** accept bags with actual recorded size, maan, khorwar,
kilograms, and fractional quantities using kg as the common stock unit with
one-gram precision. Allow business-owned custom weight measures and different
quantity/pricing units with immutable transaction snapshots under
[ADR 0019](adr/0019-pilot-numeric-settlement-policy.md).
The founder defines 1 maan as 4.4 kg and 1 khorwar as 100 maan for this pilot;
[ADR 0017](adr/0017-cash-currencies-local-measures.md) amends ADR 0004.

**Decided — G3 cash and currency:** record cash supplier payments; keep AFN and
PKR balances separate by payable currency. ADR 0019 permits mixed whole AFN/PKR
cash using a permanently recorded supplier-agreed rate, quoted as PKR per AFN
with up to six decimals. Convert the combined value exactly and round half-up
once to two decimals for allocation. Unpaid fractions stay outstanding unless
the owner records an audited reduction, cumulatively capped at 0.99 in the
payable's currency. Online payment integration and unapplied credit stay deferred.
These are future workflow requirements; current onboarding still accepts AFN only.

**Decided — G3 product identity:** each product is one stock identity for the
pilot. Defer grade, origin, harvest-date, and quality distinctions unless G1
observes an attribute as operationally distinct stock for purchasing, storage, or
pricing; see [ADR 0005](adr/0005-product-stock-identity.md).
Authorized users add their business's own product names under Task 14, rather
than choose from a predefined goods list. Custom names do not change the pilot's
market or its research prerequisites.

**Decided — G3 receiving:** permit a receipt quantity that differs from its
purchase-order quantity only with wholesaler-owner approval. Revisit the approver
only if G1 shows the owner is unavailable for routine receipts; see
[ADR 0006](adr/0006-receipt-variance-approval.md).

**Decided — G3 stock policy:** never permit negative stock. Reject a transaction
that would reduce stock below zero, then investigate and correct the underlying
receipt or count discrepancy; see [ADR 0007](adr/0007-no-negative-stock.md).

**Decided — G3 sale timing:** reduce stock at dispatch if G1 establishes that
physical handoff is reliably recorded. Otherwise, revisit the timing before building
a stock-decreasing sale workflow; see [ADR 0008](adr/0008-dispatch-stock-timing.md).

**Decided — G3 credit allocation:** staff enter payments against a supplier's
running balance in one debt currency, without selecting a receipt. Automatically
allocate to the oldest unpaid receipt payables, allowing a payment to cover several
receipts. Reject overpayments and supplier advances. Derive balances from payables,
allocations, and approved reductions; do not create a separate debt record. See
[ADR 0009](adr/0009-specific-obligation-payment-allocation.md).

**Decided — G3 correction authority:** require wholesaler-owner approval for stock
corrections, transaction cancellations, and any future return. Returns remain
excluded from the pilot; see [ADR 0010](adr/0010-owner-approval-for-corrections.md).

**Decided — G3 supplier debt:** accepted receipts create supplier payables from
accepted quantities and approved purchase-price snapshots. Partial receipts create
only partial debt; supplier payments reduce the outstanding balances of their
allocated payables. See [ADR 0012](adr/0012-receipt-supplier-payables.md).

**Decided — G3 terminology validation:** validate Pashto terms for product, stock
unit, supplier, purchase, receipt, receipt variance, stock balance, supplier payable,
supplier payment, supplier balance, and correction before shipping pilot labels.
Defer sales/customer-payment terms; see
[ADR 0011](adr/0011-validate-purchase-receipt-terminology.md).
The founder can arrange a Pashto-speaking owner/accounts-clerk review; the
remaining labels are still awaiting that review.

**Decided — G3 numeric policy:** ADR 0019 resolves Task 12's numeric prerequisite:
kg/gram stock, two-decimal entered unit prices, exact quantity/price conversions,
half-up two-decimal purchase lines, summed rounded lines, cumulative partial-
receipt reconciliation, and recorded mixed-currency cash settlement/reductions.
Validate remaining terminology before pilot label release under ADR 0011;
G1 acceptance does not complete that review. The
localization approach remains General Translation with `en-US` and `ps-AF`; see
[ADR 0001](adr/0001-launch-localization.md). Consult the
[build plan's gate status](agent-sized-build-plan.md#current-gate-status) for current
task readiness; founder-approved policies do not constitute completed research.

## Product boundaries

- Tenant data belongs to an organization; a client-provided organization identifier
  is never authority.
- Stock history is based on appended movements rather than overwritten totals.
- Money must use an exact database representation rather than JavaScript floating
  point when persistence is introduced.
- The deferred backlog in the [build plan](agent-sized-build-plan.md) is out of
  scope until pilot evidence changes the priority.
