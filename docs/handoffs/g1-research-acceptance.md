# G1 retrospective research acceptance

Date: 1 November 2026. Status: founder acceptance recorded; interview finished.

## Outcome and authority

The founder asked to finish G1 because all the businesses followed the same
workflow and did not need repeated questions. This came after disclosure that
the original gate still required individual interview and observation records.
[ADR 0003](../adr/0003-helmand-pilot-workflow.md#amendment--founder-acceptance-of-retrospective-g1-research-1-november-2026)
records this as acceptance of retrospective shared-workflow research and replaces
the original 20-recorded-interview/five-observation prerequisite for development.

**G1 is accepted by founder decision. The original evidence checklist is not
fulfilled or verified.** The reported 50 interviewees and approximately 50 observed
businesses stay founder-reported. Only B001/V001 and four participant references
are mapped; the owner/manager findings are attributed and worker findings remain
grouped. No other business, participant, visit, date, note, or numeric value is
invented. This acceptance changes the gate decision, not the evidence's provenance.

## Findings and scope

The [evidence register](g1-evidence-register.md) reconstructs B001's day-long Helmand
visit across all eight topics, including purchase agreement, matched and accepted
receipt, stock calculation, sale entry at handover, debt after weighing, supplier
cash payment, a writing correction, and owner review. R006–R015 identify the
current conversation's findings and uncertainties; earlier R001–R005 remain.

Approximate wheat/maize weights and the approximate maize price stay distinct from
the wheat price recalled as exact. The mixed-currency payment was to a different
supplier from the purchase example; its amounts and allocation are unknown.
The writing correction changed no stock. Workers' heavy-bag difficulty is research
context and authorizes no labour/payroll feature. Historical prices are not product
defaults, current market rates, or exact financial acceptance fixtures.

The accepted purchasing/receiving/supplier workflow remains the implementation
scope. Keep the existing exact arithmetic, receipt debt recognition, currency
separation, payment allocation, owner-only posted adjustments, tenancy, and
permission policies. Sales remain deferred. A concrete solution for real outgoing
stock must be decided before claiming live stock reconciliation in the pilot.
Remaining Pashto labels, live authentication, deployment, backup/restore, and
other pilot-release checks are not closed by G1 acceptance.

## Changed files and impact

- `docs/adr/0003-helmand-pilot-workflow.md` and `docs/adr/README.md`: acceptance
  authority, revised prerequisite, trade-off, and index status.
- `docs/agent-sized-build-plan.md` and `docs/product-requirements.md`: current G1
  status and next-task readiness, with other gates and deferred scope retained.
- `docs/handoffs/g1-evidence-register.md`: recalled findings, sources, participant
  attribution, workflow coverage, original unmet checklist, and acceptance review.
- `docs/handoffs/pilot-research-evidence.md` and `pilot-research-fieldwork.md`:
  synthesis and optional targeted follow-up in place of repeated interviewing.
- `docs/README.md` and this handoff: navigation and delivery record.
- `README.md`, `docs/architecture.md`, `docs/database.md`, `docs/security.md`, and
  `docs/adr/0019-pilot-numeric-settlement-policy.md`: consistent current readiness,
  with existing business, numeric, and security policies retained.
- `docs/handoffs/grain-wholesaler-records-research.md` and
  `pilot-readiness-decisions.md`: current-status notices over dated history.

Documentation only: no application, schema, migration, environment, dependency,
quality-command, or CI change. Existing skill-installation work is excluded.

## Review and verification

Pre-validation documentation review covered the conversation-derived summaries,
provenance and amount precision, the different supplier, grouped worker answers,
original unmet requirements, gate consistency, and downstream policy/release
limits. Corrected stale G1 blocker statements in active guidance and added current
status notices to affected dated research notes. No unresolved must-fix findings
remain. No financial, authorization, or deferred-feature policy was changed.

Local verification on 1 November 2026:

- All **375 local Markdown links**, including **58 heading anchors**, resolve
  across **71 Markdown files** in the root README and documentation tree.
- Evidence/scope assertions pass: one mapped visit, four interview references,
  no B002 record, retained approximate values, separate supplier payment, original
  unmet checklist, next Task 15, deferred customers/sales, and no supplier implementation.
- `git diff --check` passes for the documentation scope. Only documentation is
  included in this delivery; application and quality configuration are untouched.
- SHA256 comparison confirms unrelated `AGENTS.md` and `skills-lock.json` retain
  their starting contents. Existing untracked skill folders are untouched and
  excluded from the documentation commit.

Application lint/typecheck/tests/build and dependency audit are not required for
this documentation-only change. No new fieldwork, original-document inspection,
provider/browser test, deployment, or restore test was performed. Remote CI and
review must be reported separately from local document checks.

## Next task

**15 — Implement suppliers**, with G1 acceptance recorded and its research blocker
removed. This interview does not implement suppliers or authorize adjacent domain
features. No repeated per-business G1 interview is pending.
