# Deployment

## Confirmed baseline

- No hosting service, deployment pipeline, staging environment, production database,
  backup configuration, or deployment environment variables are configured.
- Amended [ADR 0018](adr/0018-managed-pilot-hosting.md) selects Netlify Free and
  Neon Free for temporary testing with synthetic business records. Paid production
  hosting is deferred. The founder owns hosting, billing, alerts, and recovery;
  USD 60/month is the approved future hosting/database ceiling. No billing limit
  or deployed resource has been configured by recording that decision.
- Staging deployment, migration handling, backup scheduling, restore verification,
  and monitoring are planned for Task 34.

## Environment configuration

- The server validates `NODE_ENV` at startup. It must be `development`,
  `production`, or `test`.
- Clerk requires `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from
  the same development or production instance; see [`.env.example`](../.env.example).
  Only the publishable key is public. The secret key remains server-only.
- `APP_ORIGIN` is the exact application origin used by Clerk's `authorizedParties`
  check. It defaults to `http://localhost:3000`; set it explicitly when using another
  port or deploying. Do not include a path, credentials, or trailing slash. Live
  Clerk instances require an HTTPS origin.
- Local-only values belong in the ignored root `.env.local` file.
- `DATABASE_URL` is required at startup and by migration tooling. Keep it
  server-only; follow the [database setup](database.md). Apply reviewed migrations
  explicitly, separately from startup and builds. CI's `quality` job uses an
  unreachable placeholder and never connects to or migrates a database. The
  separate `database` job applies committed migrations only to its disposable
  PostgreSQL service; it provides no deployment or restore evidence.
- Staging and production values will be set in the approved deployment target's
  encrypted environment configuration after remaining G4 operating policies are
  approved. They must not be committed to the repository. Secrets must never use
  a `NEXT_PUBLIC_` prefix.
- Configure real build-time publishable keys before building a deployable artifact;
  Next.js embeds public environment values in browser bundles.

## Authentication setup and smoke check

1. Create/select a Clerk development application in the
   [Clerk Dashboard](https://dashboard.clerk.com/), then copy its two API keys into
   the ignored root `.env.local`. Copy [`.env.example`](../.env.example) first if
   needed. Do not paste secrets into chat, documentation, or source control.
2. Choose the development sign-in method explicitly. Configure a disposable test
   user in that development instance. This does not approve a pilot method:
   [ADR 0002](adr/0002-clerk-authentication.md) still requires Pilot A–C phone OTP
   validation before pilot use. Disable public registration for the invited pilot;
   Task 11 supplies Clerk email invitations and manual account addition. The
   application exposes sign-in and `/join` for existing invited accounts.

   On 30 October the founder reported successful real phone-code delivery and
   completed authentication/login. The test date/environment and separate Pilot
   A–C outcomes were not supplied. See the [readiness record](handoffs/pilot-readiness-decisions.md).
   Record anonymous delivery/completion outcomes with their context; never record
   phone numbers or OTPs. A founder report does not replace deployment smoke tests.
3. Run `npm run dev`, visit `/sign-in`, and authenticate using the configured
   development method. The fallback destination is `/dashboard`; direct access to
   another protected page preserves Clerk's return destination. An authenticated
   account without an active verified local business goes to `/onboarding`.
4. Complete first-business setup, then select **Open workspace**. With an owner
   account, confirm access to products, suppliers, warehouse/catalogue settings,
   purchases, inventory, and the owner-only stock adjustment entry. Repeat the
   relevant allowed/denied paths with the intended staff roles. Supplier payments
   and sales remain unavailable, and the overview has no operational metrics yet;
   use the [build plan](agent-sized-build-plan.md#pilot-delivery-order) for current
   scope. Select **Sign out** in desktop or mobile navigation, then revisit a
   protected URL and verify it redirects to `/sign-in`. Try a fresh private window as well.
5. Repeat an anonymous protected request with Pashto selected; verify the sign-in
   flow preserves the locale preference and the document remains RTL.

Clerk owns credential validation, session issuance/refresh/revocation, and session
cookies. The app does not create its own token or override cookie flags. Production
requires a configured Clerk production instance, HTTPS, matching live keys, the
approved domain, and the exact `APP_ORIGIN`. Inspect actual cookie behavior in the
staging rehearsal; local development cookies are not production-cookie evidence.
See Clerk's [Next.js quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart)
and [production guidance](https://clerk.com/docs/guides/development/deployment/production).

## Future deployment requirements

### Development organization settings

For Task 08, enable Organizations in the **development** Clerk instance with
**Membership optional** and **Create first organization automatically** off.
This preserves sign-in before Task 09 onboarding; personal mode has no business
tenant context. Use the existing default five-member cap; no paid feature is
required. Revisit plan costs before exceeding Clerk's included membership limit.
Do not enable verified-domain enrollment or introduce business-role mappings here.

Inspect the settings after enabling. The Backend API's enable operation can turn
membership required on. The installed SDK does not expose the selection update,
but a targeted `PATCH /v1/instance/organization_settings` with only
`{"force_organization_selection":false}` was verified on the development instance
on 26 October 2026; see the [Task 08 handoff](handoffs/08-clerk-organizations.md#development-configuration-acceptance).
Verify the instance is development before changing it, and do not repeat the
enable toggle to correct membership selection. Treat neither HTTP 200 nor a
successful enable response alone as proof of the required defaults.
Clerk's public environment configuration exposes
`force_organization_selection` and
`organization_creation_defaults.automatic_organization_creation.enabled` for
verification; read both values again and also verify Organizations remain enabled.
The Dashboard's Membership optional setting is an alternative. See
[configuration](https://clerk.com/docs/guides/organizations/configure).

Tasks 09/11 implement organization creation and staff management. `/join` offers
explicit selection from the signed-in user's memberships. No profile-management
UI or webhooks are introduced. Future
background tenant requests must explicitly bind their intended organization to
the verified session context; Clerk documents a shared-cookie caveat for multiple
tabs in its [organization overview](https://clerk.com/docs/guides/organizations/overview).

### Onboarding recovery slugs

Task 09 requires Clerk **Enable organization slugs** for its stable recovery key.
Clerk disables slugs by default for newer applications. Enable them in Organization
settings before using onboarding; this adds no organization-specific routes or
switcher. Keep each reserved `afcs-<onboarding UUID>` slug unchanged until its remote
ID is pinned locally. Renaming an unpinned slug or editing its private recovery
marker outside the app requires operator reconciliation before another retry.
After pinning, retries use the Clerk ID and tolerate slug changes.

On 26 October, the first development smoke submission returned the safe failure
path because Clerk reported `organization_slugs_disabled`. Verified the configured
instance was development, then sent only `{"slug_disabled":false}` to
`PATCH /v1/instance/organization_settings`. The installed SDK omits this update
field; it is documented by Clerk's
[official Backend API specification](https://github.com/clerk/openapi-specs/blob/main/bapi/2021-02-05.yml).
A fresh public environment read confirmed `organization_settings.slug.disabled`
was `false`, Organizations remained enabled, membership remained optional,
automatic creation remained off, and the five-member cap was unchanged.
The retry then created exactly one business. This setting is a prerequisite for
each future environment; the app never changes provider settings at startup.

The development browser smoke used a temporary, explicitly marked test account and
Clerk's reserved test email-code flow. It verified creation, delayed activation,
dashboard access, saved-detail recovery, mobile RTL layout, repeated submission,
membership-removal denial, and sign-out. The synthetic remote account/organization
and their local rows were deleted afterward. This is development evidence; pilot
phone OTP, production cookies, backup restoration, and deployment remain open.

### Business authorization rollout

Apply reviewed `0003_business_roles.sql` before deploying the Task 10 guard. It
adds local assignments and the one-time owner-bootstrap marker without granting
roles to existing users. Existing Task 09 creators must explicitly resume their
saved setup, with the same details, and pass current creator/membership verification
for the initial grant. Active Clerk membership alone no longer opens protected
pages. Do not solve a denial by assigning Clerk Admin or resetting bootstrap
markers. Staff assignment and last-owner management are implemented by Task 11.

Keep the migration, assignments, and markers if application code needs a forward
fix. Rolling back to an application that lacks the guard removes permission
enforcement; it is not an authorization recovery procedure. G4 deployment, backups,
and pilot sign-in validation remain separate open gates.

### Staff invitations and manual access

Before using staff email invitations, enable Clerk Email and verify invitation
delivery and acceptance in development. The installed provider sends the email;
there is no separate email/SMS integration. Without email support, provision the
invited account through the configured Clerk sign-in/account process, ask staff
to open `/join`, then add that exact account ID under Settings → Manage staff.
Assign its local business role after membership exists. No app public sign-up,
phone registration changes, paid membership-cap changes, or provider settings
are applied by Task 11. Invitations expire after 30 days; revoke/reissue as needed.
See [Clerk invitations](https://clerk.com/docs/guides/organizations/add-members/invitations)
and [Task 11 recovery](handoffs/11-staff-management.md#expiry-and-recovery).

### Staging and production

- The temporary Netlify Free/Neon Free environment uses made-up products and
  business transactions. Free-plan limits may pause testing. Clerk development
  SMS has separate limits; use its reserved test values for routine checks and
  real delivery tests only when needed. See ADR 0018's dated provider references.
- Decide paid production hosting before setup. Record the exact supported region
  and backup destination; overseas storage is permitted. Confirm separate
  authentication/SMS/domain costs and enforceable spending controls within the
  USD 60/month hosting/database ceiling. A target budget is not a configured cap.
- Retain real-pilot database backups for 30 days. The approved recovery targets
  are at most one hour of lost recent entries and usable service within four
  hours during business hours. Choose backup/restore arrangements that can meet
  both targets; retention alone does not establish recovery frequency or speed.
- Email downtime, backup-failure, and spending alerts to the founder for prompt
  business-hours response. Configure monitoring and verify delivery before relying
  on it; account ownership alone is not monitoring coverage.
- Production changes must not auto-run destructive migrations.
- Staging must not expose production data and requires a proven non-production
  restore before pilot use.
- Deployment handoffs must name the owner, provider/region, rollback procedure,
  backup destination/retention, spending controls, alert-delivery results, and
  dated restore evidence demonstrating both recovery targets.

## Decision status

**Partially resolved — G4 deployment:** temporary test hosting and the operating
targets above are approved under amended ADR 0018. Paid provider/region/destination,
separate costs, spending controls, configuration, and restore/alert verification
remain open. Task 34 still requires G1; a free test deployment does not close
the task or authorize real-business pilot use.
