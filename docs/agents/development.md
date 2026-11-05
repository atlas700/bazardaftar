# Development workflow

Read this guide for feature planning, implementation, code review, or validation.

## Before implementation

Check the [build plan](../agent-sized-build-plan.md)'s current gate status and
pilot delivery order against accepted ADRs before selecting an implementation
task. Record approved policy changes and update the affected task scope together;
preserve open evidence gates and reuse confirmed product decisions.

Before implementing a feature or change, use the project-local
[find-skills skill](../../.agents/skills/find-skills/SKILL.md) to search for a
task-specific skill, starting with project-local skills. Apply every matching
[required skill](skills.md) before its corresponding work. When no skill matches,
continue with this workflow.

## Area-specific rules

Read the relevant rule file before changing code in that area:

- [Next.js](../nextjs.md)
- [React](../react.md)
- [TypeScript](../typescript.md)
- [Tailwind CSS](../tailwindcss.md)
- [PostgreSQL and Drizzle ORM](../postgresql-drizzle-orm.md)

## Quality checks

After implementation, complete the
[pre-validation code review](../testing.md#pre-validation-code-review) before
the final quality-command pass. Earlier checks during development remain
encouraged. Run only checks affected by the change while working:

- Run `npm run lint` after changing application TypeScript, JavaScript, or ESLint configuration.
- Run `npm run typecheck` after changing TypeScript, type declarations, or TypeScript configuration.
- Run `npm run test` after changing behavior covered by tests or test configuration.
- Run `npm run build` after changing application, Next.js, dependency, or build configuration, and before handing off an application change.

For application, dependency, CI, or quality-configuration changes, run all four
commands before handoff. Documentation-only changes do not require these commands
unless they change the documented commands or their configuration.

For dependency or CI changes, also run `npm audit --omit=dev --audit-level=high`.
See [Testing](../testing.md) for the dependency gate and exception policy.
These project rules govern commands, review order, and documentation-only
exemptions when applying verification skills.

## Feature completion and review

An implementation feature is complete only when its handoff records completed
acceptance checks, changed files, pre-validation review scope, findings and their
disposition, verification evidence, limitations, and the exact next task. Record
applicable test-first evidence in that handoff. Distinguish local checks, remote
CI, and live browser/provider/deployment evidence; report skipped or unavailable
checks explicitly.

Then follow the [GitHub review delivery workflow](../github-rules.md) to commit
the feature's changes on its feature branch, push to GitHub, and request review.
