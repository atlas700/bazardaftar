# Task 34 — Connected staging and isolated backup restore

15 November 2026. Backup automation increment complete and ready for review;
**Task 34 and pilot release remain open**. Founder owns the synthetic-only test
environment. No paid upgrade or production cutover was performed.

## Live evidence

- Netlify site https://bazardaftar.netlify.app: reviewed app commit
  `8d739173344450091e656f434306a494d3497ced`, deploy
  `6af9564b59c12545f70c2996` published at 06:52:30 UTC. Correcting the hosted
  `APP_ORIGIN` and rebuilding cleared the observed admission/sign-in 503.
  Hosted `/health` and the supplied sign-in URL returned 200.
- All 18 committed migrations were applied/reapplied on the connected Neon
  PostgreSQL 18 source; hashes/timestamps matched. Runtime uses a pooled URL;
  backup uses a separate direct read-only login. No migration runs at app startup.
- Founder reports completed AtlasLLC onboarding and purchase/payment test.
  Transaction identity and balances were not independently verified; the founder
  requested no further investigation. This is user-reported workflow evidence.
- Founder confirmed UptimeRobot checks `/health` every five minutes and receipt
  of its test notification. Actual outage/recovery delivery remains unverified.
- [Hosted backup rehearsal](https://github.com/atlas700/bazardaftar/actions/runs/43697131456)
  succeeded at branch commit `1cc0cbf`. Source recovery point
  `2026-11-15T09:01:13.499176Z`; backup and restore completion events at
  `09:01:28.445Z` (about 15 seconds later). Archive: 86,362 bytes, private B2
  `staging/postgres/20261115T090127Z-c44e400a3e10433f8c5657a99a18505e.dump`.
  Uploaded size, metadata and AES256 encryption were checked; downloaded SHA256
  matched before atomic restore into a new isolated PostgreSQL 18 service.
  Restored migration count was 18. The source was never a restore target.
- B2 actual region is `us-east-005`; supplied `us-west-002` configuration was
  corrected privately. Private bucket and encryption were checked. Native
  lifecycle readback confirms this prefix hides after 30 days and deletes hidden
  versions after one more day; other prefix rules were preserved. Actual expiry
  after 30 days has not elapsed and is not claimed.

## Delivered files and operation

- `.github/workflows/staging-backup.yml`: main-only scheduled/manual job,
  serialized runs, PostgreSQL 18 tools and disposable restore service. The
  temporary feature-branch rehearsal trigger was removed after success.
  Schedule activates **only after merge**; cron at minutes 17 and 47 is best effort.
- `scripts/staging_backup.py`, `scripts/backup-requirements.txt`: isolated Python
  SDK dependencies, direct Neon/TLS validation, no password in command arguments,
  temporary archives, encrypted upload/readback/download, fail-closed restore and
  redacted errors. No app dependency or database migration was added.
- `scripts/staging_backup_test.py`, `.github/workflows/ci.yml`, `.gitignore`:
  nine stdlib tests in quality CI; ignore Python cache files.
- `docs/staging-setup.md`, build plan and docs index: updated current instructions.
  Existing unrelated `scripts/test-database.mjs` changes were preserved/excluded.

Repository secret names: `STAGING_BACKUP_DATABASE_URL`, `STAGING_BACKUP_KEY_ID`,
`STAGING_BACKUP_APP_KEY`. Variables: `STAGING_BACKUP_BUCKET`,
`STAGING_BACKUP_REGION`, `STAGING_BACKUP_ENDPOINT`. Values were set privately.
The separate database role has CONNECT, schema USAGE, table/sequence SELECT,
default grants for the migration owner, read-only defaults and connection limit 2.
The supplied B2 key is bucket-restricted but broader than needed: replace it with
a minimally scoped backup key before real use. Do not copy backup credentials to
Netlify. To disable automation, disable this Actions workflow; existing stored
archives and source records remain intact. Lifecycle changes require separate
review because they affect stored-object expiry.

## Review and verification

Pre-validation review used REVIEW.md and Ponytail review over the complete diff
from `origin/main`, excluding the unrelated test-database edit. Traced workflow
entry points, credential flow, dump/upload/download/restore failures, target
isolation, atomic restore, retention and scheduler limitations. Expected load is
one small synthetic database, twice hourly.

- Fixed P1: restore omitted `--dbname`, causing SQL output instead of execution.
  Test checkpoint `bc2585c` failed for the missing option; fix `1cc0cbf` passed and
  live restore succeeded. Initial six-test missing-module RED checkpoint
  `ab5ff6b` became GREEN with implementation `1a3cf41`.
- Removed temporary branch trigger/guard exception; final workflow allows main
  only. No remaining must-fix finding in this staging automation scope.
- Python tests: 9 passed. Lint, typecheck, default tests, production build and
  production dependency audit passed in the final post-review pass: 76 test files,
  903 tests passed; 15 files / 272 opt-in database tests skipped. Audit found zero
  vulnerabilities; `git diff --check` passed. Earlier remote Quality and Pilot
  browser runs at `937528e` also passed. No new local browser or database
  integration run was performed; hosted PostgreSQL restore was tested separately.

## Remaining gates and exact next task

Continue **Task 34**, before Task 35: rehearse usable application recovery with
separate Clerk mappings/runtime grants, compare business/ledger/audit totals and
verify restricted append-only audit permissions; measure incident-to-usable-app
time. Migration count and archive integrity do not prove a four-hour service RTO
or that the founder's reported transaction is in this source.

Configure and test backup-failure/staleness emails, actual downtime/recovery
emails and spending alerts/controls. GitHub schedules can delay/drop runs and
disable after public-repository inactivity, so this job does not guarantee the
approved one-hour data-loss target. Select the paid recovery/scheduler arrangement
and enforceable costs within the approved USD 60/month ceiling before pilot use.
No full recovery, 30-day elapsed expiry, backup email delivery, provider spend
controls or production readiness is claimed. Keep real business data out of this
temporary environment. Pashto validation, pilot authentication evidence and
outgoing-stock reconciliation retain their separate gates.
