# ADR 0017: Record cash in AFN or PKR and accept local weight measures

- **Date:** 2026-10-27
- **Status:** Accepted; amended by ADR 0019

**Current gate note — 5 November 2026:** G1 was accepted on 1 November under
[ADR 0003's amendment](0003-helmand-pilot-workflow.md#amendment--founder-acceptance-of-retrospective-g1-research-1-november-2026).
The open-G1 statements below describe earlier decision/amendment dates. Numeric
and settlement policy follows ADR 0019 and amended ADR 0009; the
[build plan](../agent-sized-build-plan.md#current-gate-status) owns current readiness.

**Amended by [ADR 0019](0019-pilot-numeric-settlement-policy.md):** the completed
interview approves kg/gram stock, custom weight measures, two-decimal unit prices,
cumulative receipt rounding, and mixed AFN/PKR cash settlement at recorded rates.
It replaces the same-currency-only restriction and open numeric-policy statements
below. Retain the original pilot measure definitions; G1 remains open.
The 30 October amendment to [ADR 0009](0009-specific-obligation-payment-allocation.md)
also replaces selected-payable entry with supplier-balance entry and automatic
oldest-first allocation within one debt currency. The original decision below
is historical where these amendments replace it.

## Context

During blocker clarification, the founder reported interviewing businesses that
record purchases and sales in notebooks. Purchases can use bags, maan, fractional
measures, or kilograms. The founder approved recording cash payments, separate
AFN/PKR balances, and each bag's actual size. This amends ADR 0004's prohibition
on entering purchases and receipts in different weight units; it does not close G1.

## Decision

- Record physical cash payments; online payment integration remains excluded.
- Support AFN and PKR obligations with separate balances for each currency. Each
  purchase and its receipt payable use one selected currency; each payment must
  use its selected payable's currency. Do not add cross-currency
  settlement, exchange rates, or a combined monetary balance during the pilot.
- Accept purchase and receipt quantities in kilograms, maan, khorwar, and bags,
  including fractional quantities. The founder's pilot definitions are exactly
  1 maan = 4.4 kg and 1 khorwar = 100 maan = 440 kg. These are pilot definitions,
  not a claim that local measures are uniform across Afghanistan.
- Record actual bag size for the affected line. A 10-maan bag weighs 44 kg; an
  11-maan bag weighs 48.4 kg. Retain the entered quantity, measure, bag size when
  applicable, and agreed price basis so later changes cannot reprice past goods.
- Keep one consistent stock unit per product and use exact approved weight
  conversions for comparison and aggregation. Do not equate a bag count with a
  fixed weight or introduce a general conversion-rule editor.
- Preserve exact agreed quantities and unit prices during calculation. The
  founder approved monetary purchase-line totals to two decimal places using
  half-up rounding once per purchase line. Round to the nearest 0.01; an exact
  halfway value rounds away from zero, so 62.785 becomes 62.79. Sum those rounded
  line amounts for the purchase total;
  do not round intermediate quantities or products, or recompute the total from
  unrounded lines. This applies to both AFN and PKR.
- The canonical stock unit, quantity/unit-price input scales, price-entry
  conventions, partial-receipt rounding/reconciliation,
  and cash treatment of fractional balances still require approval before Task
  12. Two-decimal purchase lines do not settle these remaining numeric policies.

## Consequences

Tasks 12–14, 18–21, and 25–28 must preserve quantity and currency meaning through
purchases, receipts, payments, and read models. Cash allocation still follows
ADR 0009 and receipt-based debt follows ADR 0012. Existing onboarding remains
AFN-only; this decision scopes future trade workflows and does not claim PKR or
weight entry is already implemented. G1 and the remaining numeric-policy gates
remain open; monetary line precision, half-up tie-breaking, and the purchase-line
rounding stage are approved.

## Links

- [Previous units policy](0004-single-stock-unit.md)
- [Payment allocation](0009-specific-obligation-payment-allocation.md)
- [Receipt supplier payables](0012-receipt-supplier-payables.md)
- [Build plan](../agent-sized-build-plan.md)
- [Clarification and evidence record](../handoffs/pilot-blocker-clarifications.md)
