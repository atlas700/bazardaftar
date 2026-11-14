# Code review

Use this guide when reviewing BazarDaftar changes. Start with [AGENTS.md](AGENTS.md)
and follow its task-specific links. The review procedure and validation order live
in [Testing](docs/testing.md#pre-validation-code-review); required checks and the
documentation-only exemption live in the [development workflow](docs/agents/development.md).

## Scope

Identify the comparison base, reviewed commit or working-tree diff, and originating
task's acceptance criteria. Read the complete diff and affected callers, tests,
fixtures, configuration, and migrations. Consult the relevant
[accepted ADRs](docs/adr/README.md) and [domain guidance](docs/agents/domain.md)
when evaluating business behavior.

## Review focus

- Correctness: trace success, failure, retry, and concurrent execution paths;
  check rollback, durable idempotency, and preservation of historical data.
- Security: trace server-derived identity, business membership and permissions,
  tenant isolation, input validation, and sensitive-data handling through mutations.
- Domain rules: verify exact money and quantity arithmetic, currency separation,
  stock movements, and settlement behavior against the applicable accepted ADRs.
- UI: apply the [design and styling requirements](docs/agents/skills.md#design-and-styling)
  and check Pashto/RTL, keyboard access, error recovery, and permission boundaries.
- Evidence: check regression coverage for affected behavior and distinguish local
  checks, remote CI, and live provider or deployment verification.

## Findings

Use P0 for an immediate release blocker, P1 for an urgent defect, P2 for a normal
priority defect, and P3 for a low priority improvement. Base severity on the
demonstrated impact and likelihood; report style preferences only when they
violate a documented requirement.

Report actionable findings with severity, file and line, triggering conditions,
user impact, and the smallest corrective action. Cite the violated requirement
when applicable; distinguish confirmed defects from questions or missing evidence.
State explicitly when no findings are found, and list review limitations and checks
not run. For implementation handoff, record finding dispositions and recheck fixes
as required by the review procedure above.

For a review-only request, report findings without editing files. Implementation
and fixes follow the development workflow when authorized.
