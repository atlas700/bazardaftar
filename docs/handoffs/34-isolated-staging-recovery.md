# Task 34 — Isolated synthetic staging recovery

18 November 2026 Kabul. **Task 34 tracking was closed by explicit founder direction
on 18 November for synthetic staging scope.** This administrative status does not
mean outstanding provider or production gates passed. Task 35 has not started and
readiness issue #65 remains open. The founder owns the accounts, alerts and
recovery. No paid upgrade or production cutover was authorized or performed.
Recovery, backup and monitor results below are dated evidence; freshness was not
rechecked on 18 November.

## Recovered target and continuity

After the saved staging endpoint became inaccessible, the founder authorized a
separate Free synthetic target while preserving every existing database. Live
management access confirmed Free capacity before creation. Created one independent
Neon PostgreSQL 18 project, `bazardaftar-synthetic-recovery-20261116`, with a root
`synthetic-staging` branch, database and endpoint in `aws-eu-central-1`. It is not
a child copied from an unverified branch. Exact provider identities and credentials
are retained in the private recovery record.

Restored the verified original synthetic B2 archive with recovery point
**2026-11-15T10:50:55.262035Z**, from [run 43705966532](https://github.com/atlas700/bazardaftar/actions/runs/43705966532).
AES256, size and SHA256 matched the recorded archive. PostgreSQL 18 tools restored
it atomically into the verified empty new database, without imported ownership or
privileges. All 18 migrations and raw rows across 21 tables, including migration
history and request counters, matched afterward. Existing databases and source
archives were unchanged. This is archive recovery, not a blank rebuild; continuity
after that historical recovery point is **not established** by the later backups.

Created separate owner, runtime and backup roles only in the new target. The
runtime role owns no tables, has no public-schema CREATE or inherited memberships,
and cannot UPDATE/DELETE/TRUNCATE audit history. The backup role has CONNECT,
schema USAGE and table/sequence SELECT, defaults for objects created by the
executing migration owner, and read-only transactions by default. Live privilege
and credential checks passed. A connection reset after setup was reconciled with
the saved credentials and committed roles before verification; setup was not
blindly rerun. A bounded static role-setup review found no must-fix findings.

## Credential cutover and evidence

Only GitHub secret `STAGING_BACKUP_DATABASE_URL` changed to the new direct backup
login. Only the confirmed synthetic Netlify site's `DATABASE_URL` value in its
main/`production` deployment context changed to the new pooled runtime login.
Netlify's context name does not classify this site as a real-business production
environment. Guards checked site/origin, repository, main branch, allowed branches,
new database identity, role and pooled connection before mutation. The patch
targeted only that DB value; readback preserved other context entries, scopes,
auth entries and site build settings. Secret values remained API-masked, so their
plaintext was not compared. Owner/backup credentials were not placed in app
runtime. No existing database, other site or role was changed.

All application runs below used main at the time of recovery
`447c9cfc0a56b025f81fd81a479d409df3741071`:

| Evidence | Result |
| --- | --- |
| [Initial recovered-source backup 43856196908](https://github.com/atlas700/bazardaftar/actions/runs/43856196908) | Passed archive, disposable restore, 18 migrations, 20 table fingerprints, restricted runtime grants and freshness update. |
| [Recovery browser 43856472479](https://github.com/atlas700/bazardaftar/actions/runs/43856472479) | Production build and one browser test passed; completed 11:20:12 UTC. Existing owned fixtures verify one receipt after replay, stock 4 kg, debt 40 AFN and 25 AFN payment leaving 15 AFN; cleanup stays in the disposable environment. |
| [Fresh activation backup 43942023582](https://github.com/atlas700/bazardaftar/actions/runs/43942023582) | All archive/restore/row/grant/freshness events passed; recovery point 19:42:22.953871 UTC. Independent B2 HEAD matched encryption, size and archive metadata. |
| Cleared-cache hosted deployment | Main published at 19:44:47.120 UTC. Exact `/health` returned 200 with `status: ok` at 19:46:10.599 UTC. Private deploy/build IDs and readbacks are retained. |
| Hosted browser | Public home rendered; **Open workspace** redirected to the development Clerk sign-in page. No hosted authenticated business transaction, real OTP or production-cookie acceptance is claimed. Full business workflow evidence above is from disposable recovery CI. |
| Freshness activation | Verified the actual monitor's separate signed marker returned 200, `ok`, and `Cache-Control: no-store`, with expiry 20:27:22 UTC. Resumed only after the fresh successful backup; readback progressed from STARTED to UP. Target and alert contacts were unchanged by resume. |

The automated 20-table comparison includes migration history and excludes mutable
request-admission counters. It is distinct from the one-time 21-table archive
comparison. Existing fixtures retain their loopback-only database guard; they were
not pointed at the hosted database. Health and public navigation do not prove
authenticated hosted workflow or recovery-time targets. The 45-minute marker,
five-minute checks and GitHub scheduling delays remain synthetic monitoring limits.

## 17–18 November follow-up evidence and founder closure

On 17 November UTC, [current-main backup run 44155208289](https://github.com/atlas700/bazardaftar/actions/runs/44155208289)
completed successfully on main commit `d5f4b63d04700331f26d7304c4f3c59afc6ce18a`.
Its fresh marker returned HTTP 200 with `ok` and `Cache-Control: no-store`; the
UptimeRobot monitor read UP after the run. This is dated evidence only; the
45-minute marker has since expired, so current freshness is unknown.

On 18 November, the signed-in B2 Caps & Alerts page showed email alerts enabled
for storage, download bandwidth, and Class B/C transactions. The page's Edit Caps
flow required entering a credit card, and Billing showed no payment method. No
card was added and no cap setting was changed; a separate custom spending ceiling
was therefore not established. The current billing estimate showed $0.00 for
17 November. These observations do not establish alert delivery or cap enforcement.

A read-only Gmail search for provider quota/usage/spending alerts found no
qualifying notice. The only result was an unrelated Neon product newsletter dated
11 January 2025. No email was opened or sent. No quota was deliberately consumed
to trigger an alert.

The founder's 18 November instruction closes Task 34 tracking for synthetic
staging. It does not mark provider notification delivery, custom B2 cap editing,
elapsed retention, production recovery or other pilot-release gates as passed.

## Quotas, remaining gates and next action

The new Neon endpoint is fixed at 0.25 CU min/max, with default scale-to-zero,
six-hour history and Free quotas. Netlify readback before cutover confirmed Free,
automatic top-up disabled, overage accumulation excluded and no exceeded quota.
No billing setting changed. These controls do not establish production costs or
uninterrupted availability on Free plans.

Provider notification receipt remains missing. The 18 November Gmail search found
no qualifying notice in the searched mailbox. B2's account page showed alert
recipients enabled, but custom cap editing required a credit card; no custom cap
was set or verified. The founder deferred paid setup. [B2 documents account-console
cap/alert controls](https://www.backblaze.com/docs/cloud-storage-create-and-manage-caps-and-alerts).
[Netlify documents automatic usage emails](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/billing-faq-for-credit-based-plans/),
but no supported test-delivery endpoint was established through available APIs.
[Neon spending notifications](https://neon.com/docs/introduction/spending-notifications)
require Launch/Scale; no paid upgrade was made to obtain them. Historical monitor
emails are not provider quota/spending evidence. No usage was deliberately burned
or receipt invented to close this gate.

**Remaining operational gate:** obtain genuine provider quota/spending delivery
evidence through a supported no-cost path or an actual provider notice. Record
any receipt privately and only redacted results in [readiness #65](https://github.com/atlas700/bazardaftar/issues/65).
Task 34's administrative closure does not provide that evidence or resolve Task
35 admission through [map #64](https://github.com/atlas700/bazardaftar/issues/64).
Native dependencies
#65 → #66/#67 → #68 remain open. Production provider/cost decisions, retention,
scheduling, authenticated hosted recovery and other pilot-release gates remain
separate and unaccepted.

For a regression, stop synthetic writes and prefer a forward fix against this
verified target. Recheck auth and permissions after any compatible application
rollback; do not restore an archive over any existing database or switch back to
an inaccessible/unverified target. Pause freshness monitoring before disabling its
backup workflow. Preserve the source archives and new database for investigation.

## Documentation delivery

This increment adds this handoff and corrects current status in the staging guide,
deployment guide, build plan, ADR 0018 implementation status and documentation
index. Historical handoffs remain dated evidence. No app, workflow, migration or
dependency code changes. Private operational helpers/evidence stay outside Git;
the unrelated `scripts/test-database.mjs` edit is excluded.

Coordinator self-review covered the complete six-file diff against main
`447c9cfc0a56b025f81fd81a479d409df3741071`, the saved recovery evidence,
backup/fingerprint implementation, browser assertions, ADR 0018 and REVIEW.md.
Corrected wording that could imply the 16 November provider checks were fresh
17 November verification. No unresolved must-fix findings. The attempted delegated
documentation review did not complete; this is a self-review, not independent approval.
Final documentation checks passed: 197 local Markdown targets, 16 anchors,
`git diff --check`, credential-pattern scan and manual public-evidence review.
The six-file scope was checked; the unrelated script's SHA256 is unchanged.
Application lint/typecheck/test/build and dependency audit are exempt for this
documentation-only increment; the existing CI/build/provider evidence above is
separate. `src` is unchanged, so no Graphify refresh is required.
