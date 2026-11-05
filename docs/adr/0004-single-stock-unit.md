# ADR 0004: Use one stock unit per product for the pilot

- **Date:** 2026-10-19
- **Status:** Accepted

**Current gate note — 5 November 2026:** G1 was accepted on 1 November under
[ADR 0003's amendment](0003-helmand-pilot-workflow.md#amendment--founder-acceptance-of-retrospective-g1-research-1-november-2026).
References below to open research describe the earlier decision/amendment dates.
The [build plan](../agent-sized-build-plan.md#current-gate-status) owns current readiness;
the measure amendments below remain applicable.

**Amended 27 October 2026 by [ADR 0017](0017-cash-currencies-local-measures.md):**
retain one stock unit per product, but accept equivalent local weight measures
and fractional quantities with actual bag sizes. The conversion exclusions below
are historical. [ADR 0019](0019-pilot-numeric-settlement-policy.md) subsequently
resolves the numeric policy, including custom weight measures; G1 remains open.

## Context

The pilot needs a units policy before product, purchase, receipt, and inventory
schemas can be designed. Supporting purchases in one unit and stock in another
would require trusted conversion rules; G1 workflow research is not yet complete.

## Decision

- Each product uses exactly one stock unit during the pilot.
- Purchase quantities, receipt quantities, and inventory movements for that
  product use its stock unit; cross-unit conversion is out of scope.
- Revisit this decision before implementation only if observed wholesaler workflows
  show both that purchasing and physical stock routinely use different units and
  that a stable, trustworthy conversion is available for each affected product.

## Consequences

- Task 13 may model a product unit without conversion rules.
- Staff must not estimate or apply unapproved unit conversions in pilot records.
- G1 evidence that meets both reconsideration conditions requires a deliberate
  replacement decision and a safe data-model review before conversion support is
  introduced.

## Links

- [Product requirements](../product-requirements.md)
- [Database](../database.md)
- [G3 and Tasks 13–14 build plan](../agent-sized-build-plan.md)
