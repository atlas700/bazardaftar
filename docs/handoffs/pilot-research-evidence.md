# Pilot research evidence — founder interview

Initial record: 28 October 2026. Updated: 1 November 2026.

## Source and status

The founder confirmed this anonymized summary in a one-question-at-a-time
`interview-me` session and approved saving it. The answers are founder-reported
evidence, not an independently verified study or business-by-business observation
log. No business names, contact details, transcripts, or financial records are
included.

The latest interview was confirmed by the founder on 30 October, with explicit
authorization to save it in the related project docs. The founder reports
**50 people interviewed and approximately 50 businesses personally observed**,
with the same workflow across them. No notes were taken; these are recalled
findings, not a dated participant/visit register or independently verified totals.
The participant-to-business mapping has not been recorded.

The most recent observation was described as about one week before this interview
(approximately 23 October 2026, not an exact visit date). The founder pointed back
to the already reported weighing, receiving, and notebook process rather than
supplying a new transaction example. No new workflow detail is inferred from that
confirmation. See the [confirmed G0–G4 plan](pilot-readiness-decisions.md).

**G1 accepted by founder decision on 1 November.** After reconstructing B001,
the founder requested completion because the businesses followed the same workflow
and did not need repeated questions. The [ADR 0003 amendment](../adr/0003-helmand-pilot-workflow.md#amendment--founder-acceptance-of-retrospective-g1-research-1-november-2026)
replaces the original 20-recorded-interview/five-observation prerequisite with
acceptance of the retrospective shared findings. The original checklist is not
fulfilled or verified. No historical notes, exact dates, participants, or visits
are manufactured. The earlier ten-interview report is superseded by the reported
50; approximately 40 findings was never an interview count. Pilot label and live
release checks remain separate.

## Confirmed workflow summary

The earlier interview recorded the following workflow summary. Its attribution
to a fruit-and-nut wholesaler remains unconfirmed: the follow-up identified grain
and mixed-goods businesses, without establishing fruit-and-nut coverage.

1. Agree the goods, quantity, and price with the supplier, then record the purchase
   in a notebook.
2. On delivery, weigh the goods and record the actual received quantity.
3. Record supplier debt after weighing and accepting delivery, using the actual
   received weight and agreed price.
4. Calculate available stock from incoming and outgoing notebook quantities.
5. Record supplier cash payments with the amount and date, reducing the supplier's
   running balance. Payments are not assigned to individual purchases in the
   observed notebook process.
6. The owner checks mistakes and records a correction with the revised balance.
7. The owner regularly checks current stock, the remaining balance for each
   supplier, and cash payments made.

Staff's stated day-to-day need is an accurate total balance for each supplier;
tracking which individual purchases are unpaid was not identified as necessary.
These confirmations describe the reported workflow, not completed app behavior.

## Follow-up evidence — 28 October 2026

The founder chose to complete G1 research before Task 14, rather than authorize
another implementation exception. The following answers add detail to the same
research; they are not additional interview participants or observation counts.

- The interviews covered grain businesses and businesses selling mixed goods.
  The business discussed mainly buys and sells wheat (غنم) and maize/corn
  (جواري). Other goods and the number of interviewees in each segment remain
  unconfirmed. The founder subsequently approved grain and mixed-goods wholesalers
  as the first pilot market, recorded in ADR 0003's market amendment.
- The business operates throughout the year, with busier months for buying and
  selling. The founder did not establish the observation's month or year.
- Workers receive 3 AFN for carrying one bag. Office staff manage payments to
  workers and suppliers. The founder confirmed personally watching these
  processes. The bag-carrying payment is a labour charge, not a goods price;
  this finding does not authorize a payroll or labour-payment feature.
- After paying a supplier, office staff record the amount paid and remaining
  supplier balance in a notebook. The founder confirmed this description.
- Incoming goods are recorded by both bag count and weight. When delivered weight
  differs from the agreed amount, office staff check with the owner before
  accepting the delivery. The founder confirmed these descriptions.
- Outgoing goods are recorded in a notebook. The founder did not confirm the
  fields in those entries or when they are written relative to physical dispatch.
- The founder requested that users add goods themselves. Task 14 must let
  authorized users enter their business's product names as needed, rather than
  select from a fixed list of wheat, maize, fruit, or nuts. This clarifies its
  existing product-creation scope and retains the requirement to complete G1 first.

## Approved market change — 28 October 2026

When asked whether the first pilot should serve grain/mixed-goods wholesalers or
the fruit-and-nut segment in the plan, the founder confirmed grain and mixed-goods
wholesalers. [ADR 0003's market amendment](../adr/0003-helmand-pilot-workflow.md#amendment--grain-and-mixed-goods-pilot-market-28-october-2026)
and the build plan record this approval. The decision changes the segment; it does
not establish observation counts, dates, or complete workflow coverage, or add
sales, customer payments, or worker payments to the purchasing pilot.

At that point, dated business-by-business coverage, private evidence references,
and the observation count remained unconfirmed. The 30 October report above
updates the counts; the evidence coverage gap remains.

The founder confirmed being able to revisit one of these businesses and take
notes while watching a purchase or delivery. Use the
[fieldwork checklist](pilot-research-fieldwork.md) to reconstruct recalled
coverage honestly and collect missing evidence on follow-up visits. Planned visits
do not increase completed totals.

## Units and terminology

- Bags and maan are written in the notebook; kilograms are used when weighing.
- The founder confirmed that staff use **«مال ترلاسه کول»** for receiving goods.
- The founder confirmed **«پاتې حساب»** for the unpaid supplier balance.

These two labels were proposed during the interview and confirmed by the founder.
They are not a complete terminology study or a pilot screen-usability test.
On 30 October the founder confirmed that a Pashto-speaking owner or accounts
clerk can review the remaining pilot labels before launch. Availability is
recorded; that review has not yet happened.
Exact weights, custom measures, gram precision, and numeric rules remain governed
by [ADR 0019](../adr/0019-pilot-numeric-settlement-policy.md).

## Payment policy decision

The 28 October interview identified a mismatch between manual selection of one
payable and the reported supplier-running-balance workflow. On 30 October the
founder approved supplier-level payment entry, automatic allocation to the oldest
unpaid receipts within each debt currency, and rejection of overpayments. No
supplier advance or unapplied credit is introduced.

[ADR 0009](../adr/0009-specific-obligation-payment-allocation.md),
[ADR 0019](../adr/0019-pilot-numeric-settlement-policy.md), and Tasks 25–26 now
record that choice together. Mixed-cash conversion remains exact with one final
rounding before allocation; AFN/PKR balances stay separate. Per-payable owner-only
reduction caps and transactional/idempotent posting remain required. This is an
approved policy change, not implemented payment behavior or completed G1 evidence.

## G1 consolidation and acceptance — 1 November 2026

The [G1 evidence register](g1-evidence-register.md) now records B001 in Helmand:
one reconstructed day-long visit, four mapped participants, owner/manager problem
summaries, grouped worker findings, and recalled observations across purchase,
receiving, stock, sale, debt, payment, correction, and reporting. It does not claim
20 reconstructed interviews or five individually mapped observations.

The same purchase agreement/delivery involved approximately 440 kg wheat and
1,000 kg maize, separately weighed and accepted by the manager with quantities
matching the agreement. Wheat's quoted 12,000 AFN per khorwar is recalled as exact;
maize's 11,000 AFN per khorwar is approximate. These historical values are not
catalogue defaults or current market prices. The observed mixed AFN/PKR payment
was for a **different supplier**; amounts, conversion, and allocation remain
unknown. The crossed-out writing correction changed no stock balance. Actual
sale entry at goods handover is now recalled as observed, not inferred from the
earlier desk-research proposal. See R006–R015 for the source distinctions.

At the founder's request, the [grain-wholesaler records research](grain-wholesaler-records-research.md)
provides proposed business records and fields. Literature supplies no missing
field observations. Further work is targeted at concrete discrepancies; the
founder requested no repeated per-business questionnaire for G1.

Remaining limitations and follow-up:

- Totals remain founder-reported; mixed-goods coverage is not separately mapped.
  Do not copy B001 into additional businesses or assign group answers individually.
- Preserve the approximate visit context and amounts; original documents and
  independent verification are absent. Interviewer guesses accompanied prompts.
- Validate remaining purchase/receipt labels under [ADR 0011](../adr/0011-validate-purchase-receipt-terminology.md).
  Observing sales or loading work adds no sales or labour feature.
- Resolve real outgoing-stock reconciliation before claiming accurate live stock
  in a purchasing-only pilot. Keep owner-only posted adjustments distinct from
  the observed writing correction; retain the approved payment policies.

The confirmed intent is a trustworthy stock and supplier-balance view using the
familiar notebook workflow. The approved payment policy is recorded in the related
ADRs; no application behavior is changed by saving this evidence. Sales/customer
payments and multiple warehouses remain excluded. Phone-sign-in evidence and
deployment/restore readiness are recorded separately in the
[30 October handoff](pilot-readiness-decisions.md).

Next: **Task 15 — suppliers**, with G1 accepted. The
[acceptance handoff](g1-research-acceptance.md) records this documentation delivery.

## Historical review and verification — 28–31 October 2026

The following records the 28 October review. The
[30 October handoff](pilot-readiness-decisions.md#documentation-delivery) records
review and verification of the latest updates.

The initial review checked the confirmed answers against the G1 threshold, pilot
exclusions, terminology decision, payment-allocation policy, and numeric/rounding rules.
Preserved approximate/source-qualified counts, incomplete observation coverage,
and the distinction between research findings and an approved policy change.
No unresolved must-fix findings. This record changes no application behavior,
schema, migration, dependency, or documented command.

Follow-up review checked the answers against this conversation, corrected the
current counts to ten reported interviews and an unknown observation total,
qualified the earlier fruit-and-nut attribution, and kept the product-name
requirement within Task 14. Recorded the approved grain/mixed-goods market in
ADR 0003 and the plan, plus the confirmed incoming quantities, owner approval,
and notebook recording of outgoing goods. Research coverage and dates remain
open; neither the market decision nor the catalogue adds a G1 exception.
The final review also checked the memory-based source qualification, planned
revisit, blank fieldwork template, private-record boundaries, and linked index.
No unresolved must-fix findings. The documentation diff passes `git diff --check`
and 122 local links/anchors across the eight changed Markdown files. Application
checks are not required because no code or documented command changed.

Changed files: `docs/adr/0003-helmand-pilot-workflow.md`, `docs/adr/README.md`,
`docs/agent-sized-build-plan.md`, `docs/product-requirements.md`,
`docs/handoffs/pilot-research-evidence.md`,
`docs/handoffs/pilot-blocker-clarifications.md`, the new
`docs/handoffs/pilot-research-fieldwork.md`, and `docs/README.md`.

At the initial interview's completion, Task 13 remained blocked by G1. Subsequently,
after being informed of that blocker, the founder instructed implementation of
Task 13; [ADR 0003's amendment](../adr/0003-helmand-pilot-workflow.md#amendment--task-13-implementation-before-g1-closure-28-october-2026)
records that limited exception. G1 remains open; Task 14 and later tasks still
require its evidence. See the [Task 13 handoff](13-units-product-categories.md)
and [maintenance handoff](postgresql-ci-verification.md) for implementation/CI evidence.
