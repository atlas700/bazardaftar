# Code review guidance handoff

Date: 14 November 2026.

## Completed scope

- Added the root `REVIEW.md` guide for review scope, project-specific risks,
  severity, actionable findings, and evidence limitations.
- Linked the guide from `AGENTS.md`, the pre-validation procedure in
  `docs/testing.md`, and `docs/README.md`.
- Preserved the existing review-before-final-validation order, required skills,
  documentation-only check exemption, and GitHub review delivery rules.

Changed files: `REVIEW.md`, `AGENTS.md`, `docs/testing.md`, `docs/README.md`, and
this handoff.

## Review and verification

Reviewed the complete documentation change against the request and the existing
agent, testing, development, and GitHub guidance. No actionable findings remain.
The review covers documentation integration, not application correctness.

Acceptance checks: all local Markdown links and anchors in the changed documents
resolve, and the task diff passes whitespace checks. Application tests, lint,
typecheck, build, and dependency audit are skipped under the documentation-only
exemption; commands and configuration are unchanged. Remote CI results remain
separate from these local checks.

## Limitations and next task

This guide is an agent instruction, not an automated CI review job. It establishes
no new application, live provider, or deployment evidence. The unrelated local
change in `scripts/test-database.mjs` is excluded from this delivery.

Next task: review the documentation PR and merge after owner approval.
