# Task 33 — One browser pilot workflow

Date: 9 November 2026. Local acceptance complete; remote CI pending delivery.

## Completed scope

Exactly one headless Playwright scenario authenticates through a real Clerk
development session, activates its organization, checks isolated seeded product,
supplier and warehouse records, creates and orders a purchase, accepts a partial
receipt, replays the actual receipt Server Action request, checks stock/debt,
records cash, and checks unchanged stock and reduced supplier debt.

The scenario buys 10 kg at 10 AFN/kg, accepts 4 kg once, recognizes 40 AFN debt,
then pays 25 AFN. UI and independent PostgreSQL checks establish 4 kg stock and
15 AFN outstanding. Replay must return the same receipt ID and leave exactly
one receipt. No application authentication bypass or mocked business mutation
is introduced.

## Fixtures, boundaries and cleanup

- Require the exact loopback `afcs_task07_verify` PostgreSQL URL without URL
  options; share Task 32's guarded target helper. Each fixture checks the actual
  connected database name before writing.
- Require matching Clerk development keys. Create a unique reserved
  `+clerk_test` account and organization with a private run marker. Official
  `@clerk/testing` sign-in uses a Backend API sign-in token; it does not send an
  email/SMS or prove phone-code delivery.
- Seed only that synthetic organization's master data and local owner grant.
  Ordinary Clerk membership checks and server permissions remain active.
- Teardown verifies private run ownership and the exact local/remote mapping,
  deletes local rows in a transaction with the audit trigger restored, then
  rechecks ownership before deleting the remote organization and account. Only
  that user's mutation counter is removed. Cleanup failure fails the test.
- Local Chrome is used on Windows; Linux CI uses bundled Chromium. Production
  server is a fresh process at canonical `http://localhost:3100`; an existing
  listener cannot be silently reused.

## CI and commands

Run a production `npm run build`, then `npm run test:e2e` with the dedicated test
database and development Clerk keys configured; see [Testing](../testing.md).
`@playwright/test` and `@clerk/testing` are pinned development dependencies.

The push/manual browser workflow uses a disposable PostgreSQL service and the
repository's `E2E_CLERK_PUBLISHABLE_KEY` / `E2E_CLERK_SECRET_KEY` secrets. No secrets
are supplied to fork pull requests. On failure it uploads synthetic screenshots
and page context for three days. This repository is public: CI traces are disabled
and cookies/authentication state are never uploaded. Local traces/reports under
ignored `artifacts/` are sensitive and must not be published.

## Review and verification

Main-agent and bounded read-only Ponytail/security review covered fixture
ownership, SQL cleanup, secrets, public artifacts, real auth, request replay,
Vitest/browser separation and CI. No unresolved findings.

- Initial local headless Chrome run passed: one test, 49.9 seconds / 56 seconds
  overall, using real Clerk and PostgreSQL. All 14 prior local tenants remained;
  fixture teardown completed successfully.
- The bundled Windows Chromium download encountered connection resets. Installed
  Chrome ran the complete test successfully; CI retains bundled Chromium.
- Shared integration target guard: all seven tests passed after extraction.
- Final `npm run lint`, `npm run typecheck`, `npm run test` and `npm run build`
  passed: 877 default tests, with 272 opt-in database cases skipped. The expanded
  lint command also covers browser fixtures, configuration and scripts.
- `npm audit --omit=dev --audit-level=high` and `git diff --check` passed.
  The existing Edge instrumentation warning remains.
- Task 32's [corrected CI](https://github.com/atlas700/bazardaftar/actions/runs/42620493763)
  passed quality and both shuffled database orders before this task's delivery.

## Limits and next task

This covers one desktop English workflow. Mobile/RTL presentation, real pilot
phone OTP, translated terminology, deployed hosting and recovery remain separate
acceptance. Token-based test authentication is not pilot sign-in evidence.

**Next task: 34 — prepare staging, migration, health, backup/restore and monitoring
setup.** The founder explicitly requested preparation for connecting Netlify and
Neon later; no hosted resources will be provisioned in this session.
