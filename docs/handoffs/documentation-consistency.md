# Documentation consistency and agent-guidance delivery

Date: 5 November 2026. Branch: `docs/current-guidance-sync`.

## Scope and compatibility

The founder authorized the documentation-audit fixes while preserving the current
and preceding builds' relationships. The branch starts at `0f7728f`, the merge of
[Task 22 PR #42](https://github.com/atlas700/bazardaftar/pull/42). That PR's head
`bb9bba9d569f9bb929d80508e4c4925485df61d2` passed its quality and PostgreSQL checks.

This change updates documentation and delivers the previously prepared agent
guidance/ECC skill bundle. It changes no application source, dependency versions,
application lockfile, build/test/CI configuration, schema, or migration. It keeps
document paths, task IDs, existing heading targets, and all prior handoffs.
The glossary's former title and the refactored agent headings retain explicit
anchors for older links.

## Changes

- Architecture describes the implemented purchase, receipt, payable, inventory,
  and adjustment boundaries, plus shared UI controls.
- Database setup checks the checked-out journal/schema and dates the Task 22
  baseline of 14 migrations and 15 public application tables. Current CI suite
  ownership links to the workflow instead of repeating obsolete suite counts.
- Deployment smoke guidance checks current routes and role boundaries. Testing
  guidance distinguishes existing coverage from later supplier-payment work and
  dates historical counts.
- ADR 0020 joins the canonical index. Dated gate notes clarify G1 acceptance in
  ADRs 0004/0017/0020 while retaining their original decision context.
- The existing build plan distinguishes implementation, review, merge, CI, and
  live pilot evidence and records the verified Task 22 delivery.
- The docs index links agent guidance, the glossary, GitHub rules, and the design
  installation handoff. The glossary uses BazarDaftar and distinguishes stock
  adjustments from deferred transaction reversals.
- The existing `AGENTS.md` refactor, `docs/agents/development.md`,
  `docs/agents/skills.md`, `skills-lock.json`, ECC notice, and eleven ECC skill
  folders are delivered together. The prepared agent refactor gains compatibility
  anchors; its linked guides, lock metadata, and imported skill files are retained.
  The thirteen imported skill files match the installed ECC 2.2.3 distribution.

## Review and verification

The focused documentation review checks audit findings against the committed
schema/journal, CI configuration, implemented service entry points, accepted ADRs,
and GitHub's Task 22 delivery record. It also checks that current status updates
do not rewrite historical evidence or authorize another numbered feature.

- All 485 local references across 85 project Markdown files resolve, including
  71 heading references. All 567 heading targets from the previous revision are
  retained, including explicit compatibility anchors in AGENTS.md and the glossary.
- All 21 accepted ADRs are indexed. All 35 numbered task IDs/titles and fenced
  command/example blocks in the 82 previously tracked project documents are retained.
- Byte hashes confirm unchanged application source, migrations, CI, application
  dependency/build/test configuration, all 38 previous handoffs, and the prepared
  skill files/lock metadata. Only the agent refactor gains compatibility anchors.
- The 35 existing skill-lock entries are unchanged; the eleven prepared ECC
  additions match the imported folders. All thirteen imported files match the
  installed ECC 2.2.3 distribution; JSON parsing and the evidence helper's
  `node --check` pass. Whitespace checks pass.
- Review resolved the old agent/glossary heading compatibility gap by adding
  explicit anchors. No task-specific documentation finding remains unresolved.

Application lint/typecheck/tests/build and database/provider/browser operations
are outside this documentation and agent-tooling change; no new application
validation or live pilot evidence is claimed.
Remote CI for this branch remains separate from Task 22's verified checks.

## Next task

**Task 25 — record and allocate supplier payments.** Customers, sales, and the
additional report suite remain deferred. Pashto terminology, physical outgoing
stock reconciliation, pilot sign-in, deployment, and restore gates remain open.
