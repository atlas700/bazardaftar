# Task-specific skill requirements

Read this guide for feature planning, implementation, code review, or validation;
apply only the skills whose triggers match the task. Prefer project-local copies
over same-named global or plugin copies.

## Code work

Before creating, updating, refactoring, fixing, reviewing, or designing project
code, use the Ponytail plugin's `ponytail:ponytail` skill at its default **full**
intensity. Follow its simplicity ladder and preserve its safety, validation,
error-handling, and accessibility boundaries alongside project rules.

When writing, changing, or reviewing code that uses a library, framework, SDK,
API, CLI, or cloud service, use the `context7-mcp` skill first to fetch
current official documentation. Follow current documented syntax for the
installed version.

## Design and styling

Before creating, updating, refactoring, or reviewing app design or styling,
read and apply both project-local skills:

- [design-taste-frontend](../../.agents/skills/design-taste-frontend/SKILL.md)
  for visual direction and design review. For workspace pages, follow its
  [app-screen workflow](../../.agents/skills/design-taste-frontend/references/app-screens.md).
- [ui-ux-pro-max](../../.agents/skills/ui-ux-pro-max/SKILL.md) for UI/UX guidance
  and the relevant focused domain or stack search; use its design-system search
  when establishing a new visual direction.

This includes page and component layouts, CSS and Tailwind classes, typography,
colors, spacing, themes, icons, animation, and responsive or interaction styling,
including small style-only edits. Match the surrounding design for focused edits.
The accepted [workspace design system](../adr/0020-workspace-design-system.md),
shared components and tokens, Pashto/RTL support, and accessibility requirements
take precedence over conflicting generic skill recommendations.

## ECC skill routing

Read and apply each linked skill before its corresponding work:

| Work in scope | Required skill |
| --- | --- |
| Feature planning, product scope, prioritization, or user-journey review | [product-lens](../../.agents/skills/product-lens/SKILL.md) |
| New functionality, utilities, dependencies, or integrations; inspect existing solutions before adding code | [search-first](../../.agents/skills/search-first/SKILL.md) |
| React/Next.js components, forms, state, data fetching, or render performance | [frontend-patterns](../../.agents/skills/frontend-patterns/SKILL.md) |
| UI layout, typography, visual hierarchy, or interaction design | [frontend-design-direction](../../.agents/skills/frontend-design-direction/SKILL.md) |
| UI implementation or review: semantics, labels, keyboard use, focus, and contrast | [accessibility](../../.agents/skills/accessibility/SKILL.md) |
| PostgreSQL/Drizzle schemas, queries, migrations, indexes, transactions, or database isolation | [postgres-patterns](../../.agents/skills/postgres-patterns/SKILL.md) |
| Authentication, authorization, tenant boundaries, untrusted input, secrets, payments, or sensitive data | [security-review](../../.agents/skills/security-review/SKILL.md) |
| New or changed behavior and bug fixes; demonstrate a failing test, then the passing fix | [tdd-workflow](../../.agents/skills/tdd-workflow/SKILL.md) |
| Browser acceptance tests, critical user journeys, or flaky end-to-end tests | [e2e-testing](../../.agents/skills/e2e-testing/SKILL.md) |
| Verification after implementation or refactoring and before handoff or a PR | [verification-loop](../../.agents/skills/verification-loop/SKILL.md) |
| CI/CD, hosting configuration, deployment, rollback, or release readiness | [deployment-patterns](../../.agents/skills/deployment-patterns/SKILL.md) |

Apply ECC guidance within project rules, accepted ADRs, and current documentation
for installed library/framework versions. Follow the
[development workflow](development.md) for quality checks, evidence, and handoff.
Skill selection does not authorize extra dependencies, features, or deployment.

The [ECC notice](../../.agents/skills/ECC-NOTICE.md) and
[skills lockfile](../../skills-lock.json) record source and provenance.
