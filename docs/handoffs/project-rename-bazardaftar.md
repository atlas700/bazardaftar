# Project rename — BazarDaftar

Date: 1 November 2026. Status: complete; ready for GitHub review delivery.

## Request and name

The founder asked to choose the best project name and apply it to the project
and GitHub repository. **BazarDaftar** pairs Bazar with Daftar to evoke a market's
business records. It suits the approved Helmand grain and mixed-goods wholesale
audience without limiting the brand to agriculture. Use `BazarDaftar` in product
copy and `bazardaftar` for the npm package and repository slug.

Public searches on 1 November for `BazarDaftar`, `Bazar Daftar`, and `BazaarDaftar`
found no obvious exact-name software conflict. This is an initial name check;
domain registration and trademark clearance were not performed. Alternatives
were rejected because [MandiLedger](https://harikanth.site/projects/) already
names a farm-accounting app and
[Mandawi](https://play.google.com/store/apps/details?id=com.mandawi.slt) already
names a local-trade app. The authenticated owner's repository list contained no
`bazardaftar` repository before the rename.

## Acceptance and changed files

- Shared branding covers the home page, desktop/mobile workspace, sign-in,
  onboarding, staff access, root error, and missing-page views.
- Homepage panel/footer, root browser-title default/template, and workspace
  descriptor use the new identity. Supporting translatable copy still uses `T`;
  the proper name stays literal across locales.
- Package and root lockfile entries agree on `bazardaftar`; dependency versions,
  integrity hashes, scripts, and application behavior are unchanged.
- GitHub repository renamed from `atlas700/code-1` to `atlas700/bazardaftar`;
  numeric repository ID remains `1378706653`. Origin points at the new URL.
  Repository description now describes BazarDaftar and its approved audience.
  The old repository API URL resolves to the same ID and new full name.
- Current docs identify the new project and explain compatibility. Historical
  ADRs/handoffs retain their original names.

Files: `README.md`, `package.json`, `package-lock.json`, `src/components/workspace.tsx`,
`src/components/ui/README.md`, `src/app/layout.tsx`, `src/app/page.tsx`,
`src/app/(app)/layout.tsx`, `src/app/page.test.tsx`, `src/app/recovery.test.tsx`,
`docs/README.md`, `docs/agent-sized-build-plan.md`, and this handoff.

## Review

Pre-validation Ponytail review covered the complete task diff, all `Brand`
callers, root metadata and child-title inheritance, package/lockfile consistency,
homepage/recovery tests, and current docs. Checked authentication, tenant,
input-validation, transaction, and secret boundaries: none are changed. Existing
Clerk `afcs-` slugs/`afcsOnboardingId` metadata, `AFCS_TEST_DATABASE_URL`, PostgreSQL
names, internal identifiers, and local checkout folder remain stable. This avoids
breaking provider recovery and existing database setups. No migration or new
dependency is needed. No must-fix code findings remained; README whitespace was
corrected before final checks. Pre-existing `AGENTS.md`, `skills-lock.json`, and
untracked ECC skill changes are excluded from this delivery.

Design review applied Taste, UI UX Pro Max, frontend patterns, accessibility, and
ADR 0020 to this focused copy change. Existing typography, colors, layout, icons,
controls, and directional styles remain intact. UI UX's verified metadata guidance
matches the installed Next.js guide and Context7. The initial text-overflow and
stack search results were off-topic; narrower searches supplied compact-label
and metadata guidance. Synthetic checks verify the longer brand fits; no new
visual direction or design-system generation was needed.

## Verification

- Test-first: homepage and missing-page branding assertions ran and failed twice
  against the old identity; the same target passed all eight tests after changes.
- Package/lockfile JSON parses and name agreement: pass.
- Synthetic rendering produced 46 fixtures from current components with mocked
  service/provider boundaries. A focused browser pass verified seven affected
  screens at 1440x900, 390x844, and 320x844 in LTR and RTL: **42 checks passed**, new
  branding present, old branding absent, no horizontal page overflow. Reviewed
  the 320px RTL homepage screenshot. Local evidence and reusable scratch scripts
  are under ignored `artifacts/rename-bazardaftar/`; no test dependency was added.
- `npm run test`: **487 passed**, **50 PostgreSQL tests skipped** because this run
  did not configure `AFCS_TEST_DATABASE_URL`.
- `npm run lint`, `npm run typecheck`, `npm run build`: **pass**.
- Task diff whitespace check: **pass**. No dependency versions or CI configuration
  changed, so the dependency audit is not required for this rename.

## Limitations and next task

The repository rename is applied remotely; application changes are delivered on
the feature branch for review and require merge/deployment to reach a live app.
Remote CI/review results must be reported separately. No live Clerk, translated
Pashto usability, deployment, domain registration, or trademark check is claimed.
No coverage tooling was added for this copy-only change, and database behavior
was not modified. G1 and the remaining pilot/provider/deployment gates stay open.

Next numbered task: **15 — suppliers**, still blocked by G1. Review/merge this
rename separately; it does not authorize the next domain task.
