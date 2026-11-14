# Connect the temporary test environment

Prepared 9 November; reviewed 14 November 2026. No Netlify or Neon account is
connected. The founder confirmed that neither test resource has been created.
This checklist implements the preparation requested by the founder; it is not deployment
evidence. Follow [ADR 0018](adr/0018-managed-pilot-hosting.md): synthetic records
only, founder-owned accounts, no paid upgrade. Task 34 and G4 remain open.

## Connect accounts and configure the app

1. Sign in to Netlify and Neon with founder-owned accounts; enable account MFA.
   Recheck current free-plan eligibility and quotas before creating resources.
   Create a separate Neon PostgreSQL 16 project/database for temporary testing.
   Record its region privately. Never copy development or real business records.
2. Save both connection strings from Neon securely: the **pooled** URL for the
   running app and the **direct, unpooled** URL for migrations, dumps and restores.
   Preserve the provider's TLS options. Do not disable certificate verification.
   Do not place credentials in this document, shell history, URLs shared in chat,
   GitHub artifacts, or `netlify.toml`.
3. Import `atlas700/bazardaftar` into Netlify. Select the reviewed staging branch,
   keep initial deployment stopped until environment and migration setup is done,
   and record the stable HTTPS `*.netlify.app` origin. The committed
   [`netlify.toml`](../netlify.toml) sets Node 24, `npm run build`, and `.next`.
   Let Netlify select its maintained OpenNext adapter; record the adapter version
   from the build log. A local Next build does not verify that adapter.
   The committed `NPM_FLAGS = "--include=dev"` also installs build tools when
   `NODE_ENV=production` is set: Tailwind/PostCSS and TypeScript are development
   dependencies. If a previous deploy reports a missing `@tailwindcss/postcss`,
   deploy the fix with Netlify's clear-cache retry option.
4. Set these values in Netlify's encrypted environment settings, scoped **only**
   to this test site. Keep deploy previews disabled until they have separately
   isolated database/auth settings. Never give a fork or arbitrary PR these keys.

   | Variable | Value / availability |
   | --- | --- |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Matching Clerk development `pk_test_…`; build and runtime |
   | `CLERK_SECRET_KEY` | Same development instance `sk_test_…`; server/build only |
   | `DATABASE_URL` | Neon pooled test URL; server/build only |
   | `APP_ORIGIN` | Exact stable HTTPS origin, without trailing slash; server/build |

   `NEXT_PUBLIC_` values are embedded at build time. Rebuild after changing the
   public key. Do not set `AFCS_TEST_DATABASE_URL` on Netlify: automated tests are
   deliberately limited to the disposable loopback database in CI.
5. In that Clerk development instance, check Organizations enabled, membership
   optional, automatic organization creation off, organization slugs enabled,
   and the existing member cap. Follow the detailed
   [authentication prerequisites](deployment.md#development-organization-settings).
   Configure only the selected test sign-in method. Verify invited access and
   allowed origins/redirects for the final host; do not assume local settings
   establish hosted cookie or OTP behavior.
6. From a trusted checkout of the exact reviewed commit, install with `npm ci`.
   Inject the **direct test URL** into this terminal's `DATABASE_URL` using your
   secret manager (do not paste a literal assignment into shell history). Check
   the project, hostname and database against the private environment record.
   Run `npm run db:migrate` twice; the second run must make no changes. Inspect
   `drizzle.__drizzle_migrations` and record the latest migration/hash. Clear the
   temporary environment override afterward. The runtime URL remains pooled.
7. Trigger the Netlify deployment. Builds and startup never run migrations.
   Save commit, build/deploy ID, Node/Next/adapter versions, migration head and
   region in the private environment record. Do not publish logs with secrets.

## Verify the deployed environment

- `GET /health` must return uncached `200 {"status":"ok"}`. It makes a read-only
  database query; connection acquisition and query each have a five-second
  timeout. Database failure produces a generic uncached 503. It checks reachability,
  not migration currency, backup freshness, Clerk delivery, or workflow correctness.
  Only exact `GET`/`HEAD /health` skip Clerk and locale middleware, allowing the
  monitor to operate without a session or an authentication-provider request.
- Use a fresh browser profile: invited sign-in, blank-account onboarding, correct
  business isolation, permissions/denial, sign-out, locale persistence and RTL.
  Check HTTPS session-cookie behavior on the actual host.
- Perform the [purchase-to-payment flow](testing.md#pilot-browser-workflow)
  manually with new synthetic records. Retry the same receipt and confirm one
  stock/debt effect. Confirm per-currency balances and the physical-count notice.
- Exercise Node proxy request admission on the deployed adapter: normal signed-in
  reads/writes, bounded 429/retry behavior, and safe 503 during a controlled outage
  on this disposable test environment. Verify database TCP support and trusted
  client-IP/perimeter controls; current anonymous budgets are shared, not per IP.
  Check Clerk-domain abuse controls separately.
- Inspect redacted diagnostics for runtime errors and request correlation IDs.
  Do not upload session traces, cookies, phone numbers, business data or raw errors.
- Record dated results and failures. A failure keeps deployment acceptance open;
  keep real pilot access closed until the security and recovery gates pass.

## Backups and a restore rehearsal

The founder owns this procedure. Before real business use, select and configure
a destination with encryption, restricted access, independent failure protection,
30-day retention and verified deletion/expiry. Select a paid/provider arrangement
capable of the approved **at most one hour lost entries / four business hours to
usable service** targets. Free testing does not establish these guarantees.

Choose provider recovery or scheduled logical backups only after checking those
capabilities and total cost. For a dump-based design, propose a 30-minute schedule
and an alert if the last **completed, durable** recovery point exceeds 45 minutes;
measure completion/transfer time and storage usage before accepting that design.
An hourly start time alone cannot prove a one-hour recovery point. Keep backup
credentials separate from application runtime credentials. Configure job-failure
and stale-backup emails; a file on the app's ephemeral disk is not a durable backup.

These are manual rehearsal commands, not a configured scheduler. Use PostgreSQL
16 client tools and private libpq service/password files (or a secret manager).
The named services below must resolve to the **direct** source test database and
a **new empty, separately named** restore database. Protect password files with
owner-only OS permissions. `pg_dump --version` must match or exceed the server
major; use a matching-major restore client.

```powershell
pg_dump --dbname="service=bazardaftar-staging-direct" --format=custom --no-owner --no-privileges --file="staging-rehearsal.dump"
if ($LASTEXITCODE -ne 0) { throw "Backup failed" }
pg_restore --list "staging-rehearsal.dump"
if ($LASTEXITCODE -ne 0) { throw "Archive unreadable" }
```

Before restoring, verify both resolved host/database identities and check that
the restore target contains no application tables. Stop if it is shared, has any
existing application records, or points to the source. Never use `--clean` or
overwrite an existing database for this rehearsal.

```powershell
psql --dbname="service=bazardaftar-restore-drill" --no-psqlrc --set=ON_ERROR_STOP=1 --command="select current_database(), inet_server_addr(); select count(*) as public_tables from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE';"
if ($LASTEXITCODE -ne 0) { throw "Target verification failed" }
# Continue only after verifying the separate target and public_tables = 0.
pg_restore --dbname="service=bazardaftar-restore-drill" --no-owner --no-privileges --exit-on-error --single-transaction "staging-rehearsal.dump"
if ($LASTEXITCODE -ne 0) { throw "Restore failed" }
```

Record the source recovery-point timestamp, backup completion, simulated incident
start and successful restored-workflow time. Compare private pre-backup totals to
the restored database: migration history, organization/role boundaries, purchase
and receipt counts, signed stock movements, AFN/PKR payables and allocations, and
audit history. Restore ownership/runtime grants separately: the archive commands
omit them. Verify restricted append-only audit privileges before using a restored
runtime. Point a separate test app at the restored database with matching test
Clerk mappings and repeat a synthetic workflow. A readable archive or healthy
endpoint is not a successful recovery drill. Keep the drill isolated; this is
never permission to repoint production or delete the source.

## Alerts, rollback and release record

- Configure an external HTTPS monitor for `/health` every five minutes, with a
  founder email after two consecutive failures and a recovery email. Use a
  monitoring timeout above ten seconds to allow both database waits. Test actual
  failure and recovery delivery on the temporary test site. Monitor redacted
  application errors separately; health alone misses workflow failures.
- Test backup-failure/staleness and provider spending alerts to the founder.
  Confirm enforceable spend/quota controls with current provider settings before
  any paid setup. Record alert timestamps and receipt privately; account ownership
  and an approved USD 60 ceiling are not configured controls. Auth/SMS/domain costs
  need separate approval.
- For an application regression, stop testing/mutations, assess the migration's
  compatibility and select the last verified compatible Netlify deploy. Re-run
  health, auth, permissions and the synthetic transaction. Never roll back to
  code without current tenant/role guards. Prefer a forward fix; never drop a
  migration or restore over live data as an application rollback.
- For data loss, stop writes and follow the isolated restore rehearsal under the
  founder's control. Verify totals and authorization before a separately approved
  cutover. Keep the original database intact for diagnosis.

Keep this acceptance record **private** and link only a redacted result in the
Task 34 handoff:

| Evidence | Required value |
| --- | --- |
| Ownership / environment | Founder; synthetic-only; account/project/site identifiers |
| Deploy | Origin, region, commit, deploy ID, adapter version, migration head |
| Access | Dated hosted sign-in, cookie, role/isolation, proxy and workflow checks |
| Recovery | Destination, schedule, 30-day retention, measured recovery point/time |
| Alerts / cost | Delivered outage/recovery/backup/spend emails; actual quota controls |
| Readiness | G1 and G4 outcomes; unresolved failures; operator/date |

## Current documentation references

Rechecked 14 November 2026:
[Netlify Next.js configuration and middleware limitations](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/),
[Neon pooled versus direct connections](https://neon.com/docs/connect/connection-pooling),
[PostgreSQL 16 pg_dump](https://www.postgresql.org/docs/16/app-pgdump.html),
[pg_restore](https://www.postgresql.org/docs/16/app-pgrestore.html), and
[libpq service files](https://www.postgresql.org/docs/16/libpq-pgservice.html).
Recheck limits/pricing before connecting; no provider resource was provisioned.
