# Task 34 — Application recovery and free staging monitoring

15 November 2026. Staging recovery increment implemented; **Task 34 and real-pilot
release remain open**. The founder limited this work to the existing free,
synthetic environment and deferred paid setup. No production cutover, source
restore, schema migration, or paid upgrade was performed.

## Recovery evidence

- [Recovery run](https://github.com/atlas700/bazardaftar/actions/runs/43705294665),
  commit `3ac375a`: dispatched 10:41:27 UTC; browser workflow finished 10:43:18;
  job completed 10:43:24 (117 seconds including provisioning and cleanup).
  Source recovery point: 10:42:20.169567. B2 upload/download and SHA256 verification
  passed. All 18 migrations and fingerprints of 20 restored tables matched the
  read-only source, including organization mappings, business records, ledgers
  and audit history. Mutable request-admission counters are excluded.
- The restored database owner is separate from the disposable runtime role.
  SQL verifies runtime cannot create public objects, own application tables,
  or update/delete/truncate audit history. Actual denied UPDATE/DELETE statements
  are checked without modifying records. Runtime can read/append audit events.
- The browser database is cloned from that verified restore. Existing real Clerk
  fixtures create ownership-marked identities/mappings; the app runs with the
  restricted runtime login. Receipt replay creates one receipt; stock remains
  4 kg and debt falls from 40 to 15 AFN after a 25 AFN payment. Administrative
  fixture cleanup stays separate. Existing mappings are preserved by the row
  comparison; the founder's original transaction identity was not investigated.
- [Recovery with freshness reporting](https://github.com/atlas700/bazardaftar/actions/runs/43705966532),
  commit `30940ce`, also passed, 10:49:56–10:52:08 UTC. Source access used the
  separate read-only backup login throughout.
- Local Docker's image download/engine failed. Successful restore/browser evidence
  is from disposable GitHub PostgreSQL 18, not a hosted failover deployment.

This measures automated synthetic recovery, not incident detection, operator
response, credential recovery, production OTP, or a guaranteed service RTO.
Concurrent source business changes after the dump cause conservative comparison
failure; repeat with synthetic writes paused. Full-table hashes/sorts suit this
small synthetic database, not an unbounded production verification workload.

## Monitoring and account controls

- Corrected UptimeRobot to exact `/health`, five-minute interval, 30-second
  timeout and the existing founder email. Free forces notification delay and
  recurrence to zero; a two-failure delay is not claimed.
- Used the duplicate homepage monitor for a failed-target/recovery rehearsal,
  then paused it. The founder confirmed receipt of DOWN and UP emails. This
  changed a monitor target, not the staging database's availability.
- Added a five-minute keyword monitor for the main backup workflow's public
  GitHub badge. A missing-success-keyword test produced a DOWN incident;
  restoring `passing` returned it UP. Badge caching/delivery limits remain.
- Native heartbeat creation returned HTTP 403 (paid plan required). The free
  freshness monitor instead checks a separate two-byte `ok` marker in private
  B2, under the existing `staging/postgres/` retention prefix. Only after backup,
  restore, row comparison and runtime-grant verification succeed does its signed
  GET link replace the monitor target. Expiry is computed from the source recovery
  point at 45 minutes old. It uses AES256 and `Cache-Control: no-store`; no archive
  URL or business data is shared. Storage/API errors fail the job. A stopped
  schedule leaves the previous link to expire independently. Provider clock
  tolerance, polling and retries add latency; this is not a production RPO promise.
- Netlify API readback matched the staging site and reported Free,
  `auto_topup_enabled=false`, `accumulate_overages.included=false`, and build
  blocking when usage is exceeded. No paid/billing setting was changed.
- Neon API readback confirmed Free and matched the source project in
  `aws-eu-central-1`, with six-hour provider history. Capped only the matching
  endpoint's min/max compute at 0.25 CU; the other endpoint/projects were untouched.
  Setting `0` uses default scale-to-zero policy. Hosted `/health` returned 200
  afterward. Five-minute database probes consume quota; free exhaustion can
  interrupt this synthetic environment.

New repository secret: `STAGING_BACKUP_UPTIMEROBOT_KEY`; new variable:
`STAGING_BACKUP_MONITOR_ID`. Both are configured privately. Provider admin tokens
were not committed or added to app runtime. The monitor API key can edit account
monitors; limit it to trusted backup/manual recovery jobs, never forks/previews.

## Changes, review and verification

Changed: `scripts/staging_backup.py`, its existing test, new
`scripts/staging_recovery_test.py`, `scripts/staging-recovery-fingerprint.sql`,
`scripts/staging-restore-runtime.sql`, backup/browser workflows,
`playwright.config.ts`, and linked operational/status docs. No new app dependency
or migration. Unrelated `scripts/test-database.mjs` formatting is excluded.

RED `d6ef51c` fails importing the missing row/grant verifier; GREEN `5996890`
passes its initial 13 tests. RED `e4354c8` fails importing the freshness reporter;
GREEN `30940ce` implements it and additional failures; 17 Python tests pass.

Pre-validation review used REVIEW.md and Ponytail review over the complete task
diff, callers, dispatch/secrets, fixture cleanup, grants, source access and marker
expiry. Expected load: one small synthetic database. Reused boto3, stdlib and
PostgreSQL. Fixed runner client-version dependency by reusing PostgreSQL 18's
image. No unresolved must-fix finding in this increment. Bounded read-only
research identified the documented source-concurrency limitation.

Graphify extraction found 235 indexed source files unchanged; refreshed local
clustering and queried existing audit/organization/ledger vocabulary. The bounded
query truncated, so current files/callers were inspected directly. No `src` change;
no further extraction required. Generated artifacts stay ignored; savings unmeasured.

Final post-review local checks passed: 17 Python tests, lint, typecheck, 903
default tests (272 opt-in database cases skipped), production build and production
dependency audit (zero vulnerabilities). Remote Quality/database and ordinary
browser CI passed at `30940ce`; the manual recovery with freshness reporting also
passed at that commit. Existing PostgreSQL 16 invariant CI remains separate from
the PostgreSQL 18 recovery/browser job. No application source changed after checks.

The live freshness test used a separate 60-second signed marker link. Its GET
initially returned uncached 200, then returned 401 after expiry. UptimeRobot
recorded DOWN/Unauthorized at 10:59:18 UTC. The founder confirmed receipt of the
workflow-failure DOWN/UP emails and freshness DOWN email. The freshness target
was then restored from the verified 10:50:55.262035 recovery point. Short-link
expiry did not happen at an exact second: provider tolerance and monitoring
latency are material, and the production RPO remains unaccepted.

## Activation, rollback and remaining gates

The main schedule cannot refresh the new marker until this PR is merged. Keep
freshness monitoring paused after its test. After merge, run the main backup job,
verify its freshness event, then resume that monitor. Leave health and workflow
failure monitors active. Never resume against an expired target.

To roll back, pause freshness monitoring before reverting its reporting code;
retain existing archives and the source. Runtime SQL is for the fixed disposable
service only; hosted least-privilege grants need separate reviewed setup.

Exact next work remains **Task 34 release gates**: production-capable scheduling/
recovery selection, incident-to-hosted-service recovery evidence, provider quota/
spending email delivery and elapsed retention evidence. Paid setup is explicitly
deferred. Confirmed monitor emails do not prove provider billing notifications.
Real-pilot access remains closed. Task 35 is not implemented by this increment.
