# Wheat and maize wholesaler records research

Date: 31 October 2026. Status: primary-source desk research; proposed record
checklist for review. This note changes no pilot policy or G1 evidence status.

Historical desk-research note: B001's later answers and the 1 November G1
acceptance supersede the then-unknown fields and task blocker described below.
See the [current evidence register](g1-evidence-register.md); literature still
adds no field observations or participant records.

## Evidence and scope

- **Literature:** FAO and CARE guidance below describes general bookkeeping and
  grain storage. It does not establish Helmand practice or B001's workflow.
- **Proposal:** the fields and daily checks below are a practical synthesis for
  a wheat/maize wholesaler, not a source-prescribed form or approved software scope.
- **Approved policy:** [ADR 0003](../adr/0003-helmand-pilot-workflow.md) limits the
  pilot to purchasing, receiving, stock and supplier reconciliation/payments.
  Sales/customer payments, returns, lot/grade tracking, multiple warehouses and
  offline operation remain excluded. Expenses below are business research, not
  authorization for a labour, transport or expense feature.
- **B001 evidence:** [R001–R005](g1-evidence-register.md#reconstruction-sources-and-participants)
  establish wheat (غنم) and maize/corn (جواری); owner, two workers and manager all
  answered questions. The founder recalls personally watching weighing and the
  manager recording actual received weight in a notebook. The exact visit date,
  individual answers, acceptance/variance handling and sale timing remain unknown.
  These are later recollections, not contemporaneous notes or four confirmed
  separate interview sessions.

## Primary-source findings

- FAO's [Record keeping, §2.9.1](https://www.fao.org/4/w6864e/w6864e0f.htm)
  illustrates a cash book, receivable/payable ledger, sales book and store book,
  with supporting invoices/receipts. Its examples concern small fruit/vegetable
  processors in Africa and Asia; only the bookkeeping principles are adapted here.
- FAO's [Monitoring grain: Definition and Weighing](https://www.fao.org/4/t0522e/T0522E0a.htm)
  covers arrival weighing and checks for moisture, impurities and insects, with
  conservation monitoring during storage. It does not establish B001's equipment
  or authorize replacing actual bag weights with estimates.
- FAO's [Store management, §5.2.5](https://www.fao.org/4/x5065e/x5065E0a.htm)
  describes daily movement journals linked to documents, bag counts and weight
  balances, inspection records, stock sheets and management reports.
- CARE's [Warehousing and storage, §6.10.1](https://www.careemergencytoolkit.org/programme-support/1-logistics/6-warehousing-and-storage/)
  describes waybills, release orders, stock/bin cards, count sheets and loss
  adjustment reports. Its stock reports compare movement balances with physical
  counts. These are humanitarian logistics controls, not legal requirements for
  an Afghan wholesaler. The direct page fetch timed out; its primary-domain
  search-indexed text was retrieved and reviewed.

## Proposed practical records

For every record, retain a unique reference, actual transaction date/time when
known, separate entry/posting timestamp, recorder and linked source document.
For retrospective research, preserve approximate/unknown event dates and record
the reconstruction date separately; never substitute today's date for the event.
Optional fields below are useful only when applicable or available. Keep private
business documents outside the repository; use anonymized, retrievable references
under the [evidence register rules](g1-evidence-register.md#recording-rules).

| Record | Proposed fields beyond the common fields | Basis and boundary |
| --- | --- | --- |
| Purchase agreement/order | Supplier; wheat/maize; agreed quantity and measure; bag count/weight basis; price and price measure; currency; total; payment terms; expected delivery date, if agreed; approver. | Preserve agreement separately from delivery. An order creates no debt under [ADR 0012](../adr/0012-receipt-supplier-payables.md). |
| Received goods and acceptance | Purchase reference; bags delivered; actual net grain weight by bag line; gross and tare where used; accepted and rejected quantity; difference from order; acceptance decision, actor and date; owner variance approval; optional weigh-slip reference. | Arrival weighing: [FAO, Weighing](https://www.fao.org/4/t0522e/T0522E0a.htm). Actual received weight alone is B001-confirmed; the remaining fields are proposals. Variance approval follows [ADR 0006](../adr/0006-receipt-variance-approval.md). |
| Stock in/out ledger | Product; receipt/dispatch/correction reference; kg in/out; resulting balance; bag count where meaningful; movement reason. | Document-linked weight and bag balances: [FAO, §5.2.5](https://www.fao.org/4/x5065e/x5065E0a.htm). Sales-related outflow is broader business research. |
| Physical count and variance | Product; count date/cut-off; counted bags and measured kg, identifying estimates; book balance; difference; recount result; explanation; correction reference and approval. | Compare count with records and document differences: [CARE, §6.10.1](https://www.careemergencytoolkit.org/programme-support/1-logistics/6-warehousing-and-storage/). Never silently replace stock with a count. |
| Sale/dispatch and customer account | Customer; goods; bags/net kg handed over; price basis; currency; value; dispatch acknowledgement; invoice date; payment dates/amounts; outstanding customer balance; optional due date. | Sales and receivable records: [FAO, §2.9.1](https://www.fao.org/4/w6864e/w6864e0f.htm). Business research only; excluded from this pilot. |
| Supplier debt/statement | Supplier; accepted receipt/payable reference and date; original amount/currency; allocated payments; separate approved reductions; remaining balance. | Receipt recognition and derived balances: [ADR 0012](../adr/0012-receipt-supplier-payables.md), [ADR 0009](../adr/0009-specific-obligation-payment-allocation.md). Never maintain an independently overwritten debt total. |
| Supplier cash payment | Supplier; chosen debt currency; actual AFN/PKR cash; agreed exchange rate when needed; converted amount; allocation references; recorder; acknowledgement/reference if available. | Supplier-level entry and oldest-first allocation under [ADR 0009](../adr/0009-specific-obligation-payment-allocation.md); numeric rules below apply. |
| Cash book | Currency; opening cash; dated cash in/out; purpose/payee/payer; linked payment, expense or other movement; closing book balance; counted cash; difference. | Cash book principle: [FAO, §2.9.1](https://www.fao.org/4/w6864e/w6864e0f.htm). Include owner cash introduced/withdrawn separately; a full cash book exceeds pilot supplier-payment scope. |
| Operating expense | Labour, transport or other category; payee; work/trip reference; amount/currency; paid/unpaid; supporting receipt; authorizer. | FAO distinguishes salaries/transport from goods costs in its [§2.9.1 example](https://www.fao.org/4/w6864e/w6864e0f.htm). Keep separate from grain quantities/prices; no payroll or expense feature is approved here. |
| Correction and approval | Original reference; error/loss reason; original value; proposed change; stock/cash/debt effect; requester; owner decision and timestamp; linked correcting entry. | Loss documentation: [CARE, §6.10.1](https://www.careemergencytoolkit.org/programme-support/1-logistics/6-warehousing-and-storage/). Owner approval for stock corrections/cancellations: [ADR 0010](../adr/0010-owner-approval-for-corrections.md). Preserve the original trail. |
| Daily owner summary | Date/cut-off; opening/in/out/closing stock by product; cash in/out/book/count by currency; new supplier debt, payments, reductions and closing balances; unresolved variances; owner review. | Proposed view derived from the records above, not a new ledger or confirmed B001 report. Full cash/outgoing coverage requires records beyond the current pilot. |

**Proposed timing:** record outgoing quantity at physical goods handover, linking
the sale and dispatch; keep order, invoice, cash receipt and posting dates
distinct. This is a review proposal, not observed B001 practice or an amendment
to the sales exclusion.

An accurate live closing-stock check needs outgoing movements included in its
reconciliation. How the purchasing-only pilot will reconcile real outgoing goods
remains a readiness question for G1 review. This checklist does not authorize a
sales module; amend ADR 0003 and its task scope together if field evidence requires
one to meet the pilot's stock-verification goal.

## Approved numeric and settlement boundaries

[ADR 0019](../adr/0019-pilot-numeric-settlement-policy.md) requires stock in kg
accurate to 0.001 kg, actual weight for each bag line, and preserved quantity/price
measure snapshots. Prices allow two decimals; round each purchase line half-up
once and sum rounded lines. Partial accepted receipts recognize cumulative
rounded line value less value already recognized.

Keep AFN and PKR debt separate. Record whole non-negative AFN/PKR cash, at least
one positive, and the agreed rate as `1 AFN = rate PKR` with up to six decimals.
Convert combined cash exactly, round half-up once to two decimals, then allocate
oldest-first within that supplier's organization and chosen debt currency under
[ADR 0009](../adr/0009-specific-obligation-payment-allocation.md). Reject
overpayment and zero-balance payments; no advances or unapplied credit. Residual
reductions require explicit owner approval, reason and separate audit record;
the lifetime cap is 0.99 debt-currency units per payable, never pooled or reset.

## Grain quality and spoilage checklist

Operational checklist only: note smell/appearance, dampness or measured moisture,
impurities, insects, damaged bags, storage leaks and signs of deterioration; record
inspection date, checker, findings and action. Monitor grain temperature/moisture
where equipment is available. These topics follow [FAO, Monitoring grain](https://www.fao.org/4/t0522e/T0522E0a.htm)
and [FAO, Store management §§5.2.3/5.2.5](https://www.fao.org/4/x5065e/x5065E0a.htm).
Do not invent a passing threshold, infer food safety from appearance, or add
grade/lot software. Link any measured stock loss to its count/correction record
and approval, rather than treating a quality note as an automatic stock write-off.

## Limits and next review

This is a working operational checklist, not an exhaustive legal/accounting
specification. No Afghan tax, statutory retention, food-safety certification or
local mandatory form was researched or established. Literature adds no B001
observations, participant answers, dates or G1 completion counts.

1. Use this checklist within accepted ADRs, retaining research-only rows outside
   pilot scope; it supplies the standard fields without another field-design
   questionnaire.
2. Map available anonymized notebook/receipt examples and existing recollections
   to the rows. Mark observed, explained and unknown explicitly; leave B001 sale
   timing unknown unless an actual source establishes it.
3. Continue the existing evidence-register review. [G1](../agent-sized-build-plan.md#g1--observe-the-work-before-modelling-it)
   still requires 20 recorded interviews, five workflow observations and complete
   per-business workflow coverage. This note does not unblock Tasks 14–35 or
   pilot release.

## Documentation delivery and verification

Documentation acceptance is complete: this checklist supplies eleven practical
record types and grain-condition checks; the linked register saves B001's
confirmed participant, goods and receiving details; collection guidance and the
build-plan gate consistently distinguish proposals from reconstructed evidence.
G1 research completion is not claimed.

Changed files: this note, `g1-evidence-register.md`, `pilot-research-evidence.md`,
`pilot-research-fieldwork.md`, `../README.md` and `../agent-sized-build-plan.md`.
No application, schema, migration, dependency, environment or quality-command
change is included.

Pre-validation documentation review checked the complete six-file scope against
ADRs 0003, 0006, 0009, 0010, 0011, 0012 and 0019 and the G1 threshold. Corrected
the stale empty-register description, preserved the approximate visit date,
kept the four participant records partial, and left sale timing unknown.
Confirmed source links and qualifications, private-record boundaries, exact
numeric policy, pilot exclusions and the unresolved outgoing-stock reconciliation
question. No unresolved must-fix documentation findings remain.

Verification on 31 October 2026: all 112 local Markdown links, including 15
heading anchors, resolve across the six changed documents; whitespace checks and
the tracked documentation diff check pass. SHA256 checks confirm all 15 unrelated
local skill-installation files remain unchanged and excluded from this delivery.
Application lint, typecheck, tests, build and dependency audit were not run:
this is documentation-only with no command or configuration changes. Remote CI
results are separate from these local checks.

Limitations: proposed fields need business validation; public guidance cannot
reconstruct missing visits or participant answers. CARE's page was available
through primary-domain search text only. No legal compliance review, live
fieldwork, software implementation or pilot readiness approval was performed.
Next research work: map real anonymized examples to the register and review the
remaining G1 coverage. Next implementation task: 14 — products, still blocked
by G1.
