# Staging guideline alignment

15 November 2026. Documentation correction; no numbered implementation task or
provider activation is completed by this change.

## Changes

- Deployment baseline and G4 deployment status now reflect the recorded connected
  synthetic staging, B2 backups, restored-app verification, staging controls and
  confirmed monitor emails. Production recovery, retention, cost and alert gates
  remain open; paid setup stays deferred.
- Deployment, architecture and security guidance describe the current proxy ->
  signed HTTP -> internal Node.js route -> PostgreSQL boundary. The transport uses
  fixed `APP_ORIGIN`; database imports stay outside the proxy graph.
- The build plan and staging checklist record PR #62's merge and require a
  verified main-branch backup refresh before resuming freshness monitoring.
- Task 35's synthetic preparation/internal dry run follows staging acceptance;
  real-business onboarding still requires production and other pilot-release
  acceptance. Task 34 remains open. ADR 0018 gains a dated implementation note;
  its operating policy is unchanged.
- Corrected the staging checklist's browser-workflow link to the existing testing
  guide heading.

Changed files: `docs/deployment.md`, `docs/architecture.md`, `docs/security.md`,
`docs/agent-sized-build-plan.md`, `docs/staging-setup.md`,
`docs/adr/0018-managed-pilot-hosting.md`, `docs/README.md` and this handoff.
Historical handoffs retain their original evidence boundaries.

## Review and verification

Reviewed the complete documentation diff against REVIEW.md, the working agreement,
the development workflow, ADR 0018, the staging recovery/boundary handoffs and the
current admission client, protocol, middleware and Node route. Applied
writing-for-agents and Ponytail review; corrected a duplicate heading and a broken
browser-workflow anchor, and preserved the distinction between recorded staging
evidence and unverified activation.
No unresolved must-fix findings.

GitHub readback confirmed PR #62 merged on 15 November at
`a473abc7e7cf9d0330e40709cab9ab0dfcdb7b5b`; no open PRs existed before this change.
Next.js Proxy runtime wording was checked against the installed 16.4.2 guide and
Context7's available 16.4.5 official documentation. No application behavior changed.

Validation: local Markdown link targets/anchors in changed documents and
`git diff --check`. Application lint/typecheck/tests/build are exempt under the
documentation-only rule: no commands, dependencies, application or CI configuration
changed. Graphify covers `src`; it is unaffected and requires no refresh.

No provider settings, backup jobs or monitors were changed or reverified. Prior
recovery and email evidence is attributed to its dated handoff. The pre-existing
`scripts/test-database.mjs` modification is preserved and excluded from this patch.

## Exact next work

Finish Task 34's free-staging checks: verify a successful main-branch backup refresh,
then resume freshness monitoring against that fresh target, and verify provider
quota/spending notifications. Task 35's synthetic preparation/internal dry run
follows staging acceptance. Production recovery/scheduling, elapsed retention and
other pilot-release evidence remain open; real-business access stays closed.
