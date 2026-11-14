# Netlify build dependency install fix

Completed locally on 14 November 2026; hosted deployment remains unverified.

## Problem and scope

The supplied Netlify log fails to resolve `@tailwindcss/postcss` while building
`globals.css`. Both `package.json` and `package-lock.json` already declare it as
a development dependency, and `postcss.config.mjs` already references it correctly.
The log lists `NODE_ENV` without its value. Netlify documents that setting it to
`production` skips development dependencies; this is the likely install cause,
not a verified account setting.

`netlify.toml` now passes `--include=dev` through `NPM_FLAGS`, ensuring build tools
are installed even with `NODE_ENV=production`. `docs/staging-setup.md` documents
that setting and a clear-cache retry. No dependency or lockfile change is needed.
These two files and this handoff are the complete change scope. The existing
uncommitted `scripts/test-database.mjs` change is excluded.

## Review and acceptance evidence

Pre-validation review used `REVIEW.md` and the Ponytail review skill. Reviewed
the complete configuration/documentation diff, package and lockfile declarations,
PostCSS configuration, and the staging install/build instructions. No findings.
No runtime, authentication, tenant, transaction, data, or secret handling changes.

- Before: with `NODE_ENV=production`, `npm config get omit` returns `dev` and
  `npm config get include` is empty. The supplied hosted log demonstrates the
  missing PostCSS module. No destructive local omission install was needed.
- After: `NODE_ENV=production` with `npm ci --include=dev` succeeded. A Node
  assertion confirmed the committed flag and resolved both `@tailwindcss/postcss`
  and `typescript` from the clean install.
- `npm run lint`, `npm run typecheck`, and `npm run build`: passed.
- `npm run test`: 74 files / 886 tests passed; 15 files / 272 database tests skipped
  without an isolated database URL.
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities. The full install
  audit reported 11 moderate development-dependency vulnerabilities; no automatic
  dependency upgrades were made in this focused configuration fix.

## Limitations and next task

Netlify account settings, remote CI, adapter behavior, hosted authentication,
health, and transaction flow have not been verified by these local checks.
No database integration or browser checks were needed for this install flag.
Merge after owner review, then retry the Netlify deploy with a cleared build
cache. Verify the install log, build, `/health`, and hosted workflow following
the staging checklist; Task 34 acceptance remains open until hosted evidence exists.

References: [Netlify dependency installation](https://docs.netlify.com/build/configure-builds/manage-dependencies/)
and [npm include/omit precedence](https://docs.npmjs.com/cli/v11/using-npm/config#include).
