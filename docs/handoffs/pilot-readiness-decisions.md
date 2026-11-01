# G0–G4 research and readiness decisions

Date: 30 October 2026.

Historical readiness record. G1 was subsequently accepted on retrospective founder
evidence on 1 November; see the [acceptance handoff](g1-research-acceptance.md).
Its revised decision supersedes the G1 reconstruction prerequisite below; other
pilot authentication, label, and operational follow-up remains required.

## Source and authorization

The founder confirmed this plan after a one-question-at-a-time interview and
explicitly requested saving it in the related project docs and pushing the
changes. Research counts and the phone test below are founder-reported. No raw
business records, participant identities, contact details, credentials, or OTPs
are included. This handoff records decisions and evidence limits; it does not
establish an implemented feature or deployed environment.

## Confirmed findings and decisions

- **G0/G2:** retain Helmand grain and mixed-goods wholesalers, Pashto-first, and
  the purchasing/receiving/supplier-payment pilot in ADR 0003. Success remains
  one business recording every purchase and receipt for four weeks with verifiable
  stock and supplier balances. Sales, customer payments, returns, multiple
  warehouses, and offline work remain deferred.
- **G1:** 50 people interviewed and approximately 50 businesses personally
  observed, with a common workflow reported across them. The most recent visit
  was about one week before this interview. No notes were taken. The
  [research record](pilot-research-evidence.md) preserves these recollections and
  the missing dated, per-business coverage; G1 remains open.
- **G3 payment entry:** staff choose a supplier and debt currency, then record
  actual cash paid without choosing an individual receipt. Allocate oldest-first
  within that currency. Reject excess payments rather than creating advances.
  [ADR 0009](../adr/0009-specific-obligation-payment-allocation.md) and
  [ADR 0019](../adr/0019-pilot-numeric-settlement-policy.md) retain exact mixed-cash
  conversion, separate AFN/PKR balances, and owner-only lifetime reduction caps
  per payable. Tasks 25–26 must implement and test these requirements.
- **G3 terminology:** a Pashto-speaking owner or accounts clerk is available to
  review the remaining labels. This establishes a reviewer, not a completed
  terminology or screen-usability review.
- **G4 authentication:** the founder prefers phone codes and reports that a real
  code arrived, was entered, and led to successful authentication and login.
  The exact test date/environment and separate anonymized Pilot A–C outcomes
  were not supplied. Retain the validation requirements in
  [ADR 0002](../adr/0002-clerk-authentication.md); do not infer production-cookie,
  invitation, deployment, or account-coverage results from this report.
- **G4 temporary testing:** Netlify Free plus Neon Free, with made-up business
  records and a USD 0 hosting/database target within plan limits. A business
  transaction is a recorded purchase, receipt, or cash payment; this decision
  adds no online payment processor. This documentation work provisions no hosted
  resources.
- **G4 real-pilot operations:** decide paid hosting later; USD 60/month is the
  approved hosting/database ceiling. Authentication/SMS/domain costs remain
  separately budgeted. Retain backups for 30 days; target at most one hour of
  lost recent entries and usable service restored within four hours during
  business hours. Overseas storage is acceptable; exact region and backup
  destination remain to be selected. Email downtime, backup-failure, and spending
  alerts to the founder for prompt checking during business hours. These are
  targets to configure and demonstrate under [ADR 0018](../adr/0018-managed-pilot-hosting.md).

## Remaining work and evidence owners

| Work | Owner | Evidence required before closure |
| --- | --- | --- |
| Reconstruct G1 records and fill workflow gaps | Founder/researcher; agent can organize the summary | Anonymized participant/visit references, source and date certainty, and required per-business workflow coverage; use the [fieldwork template](pilot-research-fieldwork.md) |
| Review remaining Pashto labels | Founder with business owner/accounts clerk | Recorded terminology and screen-review outcomes |
| Complete pilot authentication validation | Founder with Pilot A–C | Anonymous delivery and completed-login outcomes with test context; verify again in the deployment environment |
| Implement supplier-balance payment posting | Task 25 implementer after G1 | Atomic oldest-first allocation, overpayment rejection, safe concurrency/idempotent retries, exact conversion, and per-payable adjustment tests; Task 26 reconciliation |
| Finalize production hosting and costs | Founder, with technical selection delegated | Provider, supported region, backup destination, separate costs, and enforceable spending controls |
| Configure and prove operations | Founder and Task 34 implementer | Monitoring/alert delivery, backup retention, and a non-production restore demonstrating the one-hour loss and four-hour business-hours recovery targets |

Saving the plan grants no implementation exception and does not close G1, Task 34,
or pilot-release checks. The next implementation task remains **14 — products**,
blocked by G1. Immediate follow-up is the anonymized G1 evidence reconstruction.

## Documentation delivery

This change amends existing policy documents and their dependent build-plan tasks
together. It changes no application behavior, schema, migration, dependency,
environment variable, quality command, or CI configuration. Unrelated local
skill-installation changes are excluded from the documentation commit.

Completed acceptance checks: saved the confirmed G0–G4 answers, amended the payment
and hosting policies with their dependent task scopes, recorded the remaining
evidence and owners, and preserved the G1 and pilot-release gates. The docs contain
no invented participant records, precise visit/test dates, or deployment results.

Changed files:

- Research and handoffs: `docs/handoffs/pilot-readiness-decisions.md`,
  `docs/handoffs/pilot-research-evidence.md`,
  `docs/handoffs/pilot-research-fieldwork.md`,
  `docs/handoffs/pilot-blocker-clarifications.md`, and
  `docs/handoffs/pilot-numeric-policy.md`.
- ADRs: `docs/adr/0002-clerk-authentication.md`,
  `docs/adr/0003-helmand-pilot-workflow.md`,
  `docs/adr/0009-specific-obligation-payment-allocation.md`,
  `docs/adr/0011-validate-purchase-receipt-terminology.md`,
  `docs/adr/0012-receipt-supplier-payables.md`,
  `docs/adr/0013-local-postgresql-foundation.md`,
  `docs/adr/0017-cash-currencies-local-measures.md`,
  `docs/adr/0018-managed-pilot-hosting.md`, and
  `docs/adr/0019-pilot-numeric-settlement-policy.md`.
- Plan and domain guidance: `docs/agent-sized-build-plan.md`,
  `docs/product-requirements.md`, `docs/architecture.md`, `docs/database.md`,
  `docs/security.md`, and `docs/deployment.md`.
- Indexes and terms: `README.md`, `GLOSSARY.md`, `docs/README.md`, and
  `docs/adr/README.md`.

Pre-validation review covered the complete documentation diff and connected
policies. Corrected stale single-payable and paid-hosting guidance while retaining
dated historical records. Checked that automatic allocation preserves tenant and
currency boundaries, exact conversion, idempotency, per-payable reduction caps,
and one-count-per-payment statement totals. Clarified that the phone-test report
has no supplied test date and that retries must be idempotent, not always denied.
No unresolved must-fix findings remain.

Verification on 30 October 2026:

- `git diff --check` passes for the documentation scope.
- All 327 local Markdown links, including 44 heading anchors, resolve across
  64 project Markdown files.
- Provider documentation was checked on 30 October; ADR 0018 records the sources.
  Repository compatibility with the selected hosting remains untested.
- SHA256 comparison confirms that all 15 unrelated local skill files retain
  their starting contents; they are excluded from this commit.
- Application lint, typecheck, tests, build, and dependency audit were not run:
  this is documentation-only and changes no documented command or configuration.

Limitations: research totals and phone outcomes remain founder-reported; no
participant-register reconstruction, label review, application implementation,
live deployment, alert test, or restore drill was performed in this work. The
remaining-work table above is the follow-up plan; Task 14 remains blocked by G1.
