# Documentation index

This directory is the durable context for contributors to BazarDaftar (formerly
AFCS, Afghanistan Agricultural Supply Chain OS). Facts confirmed by the repository
or build plan are labelled **Confirmed**. Product and infrastructure choices that
need founder or pilot evidence are labelled **Open**.

## Product and engineering documents

- [BazarDaftar rename handoff](handoffs/project-rename-bazardaftar.md)
- [Product requirements](product-requirements.md)
- [Architecture](architecture.md)
- [Database](database.md)
- [API conventions](api-conventions.md)
- [Security](security.md)
- [Testing](testing.md)
- [Deployment](deployment.md)
- [Architecture decision records](adr/README.md)
- [Task 01 handoff](handoffs/01-documentation-shell.md)
- [Task 02 handoff](handoffs/02-quality-ci.md)
- [Task 03 handoff](handoffs/03-runtime-environment-validation.md)
- [Task 04 handoff](handoffs/04-application-shell.md)
- [Task 05 handoff](handoffs/05-localization-and-rtl.md)
- [Task 05 CI fix handoff](handoffs/05-localization-and-rtl-ci-fix.md)
- [Task 06 handoff](handoffs/06-authentication.md)
- [Task 07 handoff](handoffs/07-database-foundation.md)
- [Task 08 handoff](handoffs/08-clerk-organizations.md)
- [Task 08 completion and Task 09 readiness](handoffs/task-08-09-readiness.md)
- [Task 09 handoff](handoffs/09-first-organization-onboarding.md)
- [Task 10 handoff](handoffs/10-business-authorization.md)
- [Task 11 handoff](handoffs/11-staff-management.md)
- [Task 12 handoff and primitive import contracts](handoffs/12-domain-primitives.md)
- [Task 13 units and product categories handoff](handoffs/13-units-product-categories.md)
- [Task 14 products handoff](handoffs/14-products.md)
- [Task 15 suppliers handoff](handoffs/15-suppliers.md)
- [Task 17 warehouses handoff](handoffs/17-warehouses.md)
- [Supplier contact policy](adr/0021-supplier-contact-records.md)
- [Workspace design-system decision](adr/0020-workspace-design-system.md)
- [Workspace design-system redesign handoff](handoffs/workspace-design-system.md)
- [Page and route UX audit fixes handoff](handoffs/app-ux-audit-fixes.md)
- [PostgreSQL CI verification handoff](handoffs/postgresql-ci-verification.md)
- [Pilot blocker clarifications](handoffs/pilot-blocker-clarifications.md)
- [Confirmed pilot research interview and remaining G1 evidence](handoffs/pilot-research-evidence.md)
- [Confirmed G0–G4 readiness decisions and documentation handoff](handoffs/pilot-readiness-decisions.md)
- [G1 evidence reconstruction, revisit checklist, and private notes template](handoffs/pilot-research-fieldwork.md)
- [G1 participant, observation, and workflow evidence register](handoffs/g1-evidence-register.md)
- [G1 retrospective research acceptance and documentation handoff](handoffs/g1-research-acceptance.md)
- [Grain-wholesaler business records and source-backed field checklist](handoffs/grain-wholesaler-records-research.md)
- [Completed numeric policy interview](handoffs/pilot-numeric-policy.md)
- [Pilot-plan and quality maintenance handoff](handoffs/pilot-plan-and-quality.md)
- [Pre-validation review workflow handoff](handoffs/pre-validation-review.md)

## Existing project guidance

- [Agent-sized build plan](agent-sized-build-plan.md)
- [Next.js rules](nextjs.md)
- [React rules](react.md)
- [TypeScript rules](typescript.md)
- [Tailwind CSS rules](tailwindcss.md)
- [PostgreSQL and Drizzle ORM rules](postgresql-drizzle-orm.md)

## Documentation rules

- Update a decision record before implementing a choice that changes product
  policy, data modelling, authentication, authorization, or deployment.
- Check the [build plan's gate status and pilot delivery order](agent-sized-build-plan.md#current-gate-status)
  before selecting a task. Accepted ADRs govern policy; update affected plan tasks
  when an approved policy changes.
- Do not present a proposal or assumption as a confirmed fact.
- Keep task handoffs concise: completed checks, changed files, migration and
  environment impact, known limitations, and the exact next task.
