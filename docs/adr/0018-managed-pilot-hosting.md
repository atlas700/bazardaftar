# ADR 0018: Use free test hosting and founder-owned pilot operations

- **Date:** 2026-10-27
- **Status:** Accepted; amended 30 October 2026; deployment readiness remains open

## Context

The 27 October decision selected Vercel Pro and Neon with founder-owned
operations. On 30 October the founder chose free temporary testing before deciding
the paid production platform, and approved a spending ceiling and recovery
targets. This amendment replaces the earlier fixed paid-platform selection and
USD 40–60 planning estimate. The existing app uses Next.js and PostgreSQL.

## Decision

- Use Netlify Free for the temporary test app and Neon Free for its PostgreSQL
  database, with made-up business records. Target USD 0 for test hosting/database
  within free-plan limits. Local PostgreSQL development remains under ADR 0013.
- Decide paid production hosting later. Keep a maximum of USD 60/month for
  hosting and database; separately approve authentication/SMS/domain costs and
  confirm how taxes, other charges, and provider controls fit the budget before
  activating paid resources. The ceiling is an approved policy, not an already
  configured billing limit or a promise that every workload fits it.
- The founder owns hosting/database accounts, billing, operational alerts, and
  backup recovery. Credentials stay outside source control and public records.
- Keep temporary testing, staging, and production business data separate. Free
  test hosting does not authorize real business use or close Task 34.
- For the real pilot, retain database backups for 30 days. Target at most one
  hour of lost recent entries after a serious failure, and usable service restored
  within four hours during business hours. Select a backup/recovery design that
  meets both targets and demonstrate it with a non-production restore.
- Overseas storage is acceptable. The founder delegates selection of a suitable
  supported region when production hosting is finalized; the exact region and
  backup destination remain to be selected and recorded.
- Send downtime, backup-failure, and spending alerts to the founder by email,
  with prompt checking during business hours. Monitoring configuration, alert
  delivery tests, and the response procedure still need implementation.

## Alternatives considered

- Paying for the earlier Vercel Pro target immediately was deferred in favor of
  free testing and a later production choice.
- Vercel Hobby is restricted to personal, non-commercial use. Netlify's free
  plan permits commercial projects, making it the selected temporary test target.
- Real business records in the free test environment were excluded; synthetic
  records allow testing without depending on unverified recovery arrangements.

## Consequences

Task 34 has approved operating targets and an accountable owner. G4 deployment
stays open until the production provider, region/destination, separate costs and
enforceable spending controls are settled, configuration is complete, and restore
and alert tests pass. Backup retention does not itself prove the one-hour loss
or four-hour recovery targets. No provisioning, paid upgrade, or deployment is
authorized merely by recording this selection; this change adds documentation.

## Provider references checked 30 October 2026

- [Netlify free-plan terms and limits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)
  and [commercial-project allowance](https://www.netlify.com/blog/introducing-netlify-free-plan/).
- [Netlify Next.js support](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/).
- [Neon Free pricing and limits](https://neon.com/pricing).
- [Vercel Hobby commercial-use restriction](https://vercel.com/docs/limits/fair-use-guidelines).
- [Clerk development testing and SMS limits](https://clerk.com/docs/guides/development/testing/test-emails-and-phones)
  and [production phone-authentication requirements](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options).

Recheck current limits, eligibility, and costs before setup. Free-plan quota
pauses and development SMS limits can interrupt testing; routine test numbers
do not establish real SMS delivery. Repository deployment compatibility remains
unverified until a test deployment succeeds.

## Implementation status (15 November 2026)

The [staging recovery handoff](../handoffs/34-staging-recovery-verification.md)
records connected Netlify/Neon synthetic staging, private B2 backups, restored-app
verification, staging quota controls and confirmed monitor emails. PR #62 is
merged; post-merge freshness activation is not yet recorded. Production setup,
hosted recovery acceptance, elapsed retention and provider quota/spending email
evidence remain open. These implementation updates do not change this ADR's
operating targets or authorize paid setup or real-business pilot access.

## Links

- [Local database foundation](0013-local-postgresql-foundation.md)
- [Deployment](../deployment.md)
- [Build plan](../agent-sized-build-plan.md)
- [Confirmed readiness interview](../handoffs/pilot-readiness-decisions.md)
