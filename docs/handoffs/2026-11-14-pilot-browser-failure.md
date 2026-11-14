# Pilot browser fixture failure

Date: 14 November 2026. Local acceptance complete; remote CI pending delivery.
Investigation and focused fix for
[run 43569207787, job 132369666517](https://github.com/atlas700/bazardaftar/actions/runs/43569207787/job/132369666517),
commit `41445079aacc456e538b246d65929210e42bbfb5`.

## Evidence and root cause

Downloaded the complete job log and the `pilot-browser-failure` artifact
(`14104035997`). Inspected `error-context.md` and its entirely white 1280 by 720
screenshot. The page had not navigated: the test failed during fixture setup.
Local investigation files remain under ignored `artifacts/pilot-failure-43569207787/`.

The first application diagnostic, at 07:04:46 UTC during build, was:

```text
./src/diagnostics/server.ts:3:1
Warning: A Node.js module is loaded ('node:crypto' at line 3) which is not supported in the Edge Runtime.
    Learn More: https://nextjs.org/docs/messages/node-module-in-edge-runtime
  1 | import "server-only";
  2 |
> 3 | import { randomUUID } from "node:crypto";
    | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  4 | import { headers } from "next/headers";
  5 | import { unstable_rethrow } from "next/navigation";
  6 | import { errorReference, REQUEST_ID_HEADER, type FailureState } from "./failure";

Ecmascript file had an error

Import traces:
  #1 [Edge Instrumentation]:
    ./src/diagnostics/server.ts
    ./src/instrumentation.ts
  #2 [Instrumentation]:
    ./src/diagnostics/server.ts
    ./src/instrumentation.ts
  #3 [Server Component]:
    ./src/diagnostics/server.ts
    ./src/app/onboarding/actions.ts
  #4 [App Route]:
    ./src/diagnostics/server.ts
    ./src/db/index.ts
    ./src/app/health/route.ts
  #5 [Middleware]:
    ./src/diagnostics/server.ts
    ./src/auth/middleware.ts
    ./src/proxy.ts
  #6 [Server Component]:
    ./src/diagnostics/server.ts
    ./src/db/supplier-statements.ts
    ./src/app/(app)/suppliers/[id]/statement/page.tsx
```

This was a **warning**: build completed and Playwright started. The job-failing
error at 07:04:50 UTC was:

```text
1) e2e/pilot.spec.ts:6:1 › authenticate, receive once, and pay a supplier without changing stock
ClerkAPIResponseError: Unprocessable Entity
  at fixture.ts:23
  at OrganizationAPI.request (node_modules/@clerk/backend/src/api/request.ts:285:21)
  at Object.pilot (e2e/fixture.ts:23:28)
ClerkAPIError {
  code: 'form_param_value_invalid',
  message: 'invalid organization name',
  longMessage: 'The organization name "E2E 8211fb8d-f5b7-4246-8080-15e753123ce0" is invalid: contains a phone number',
  meta: { paramName: 'name' }
}
```

Clerk's organization-name validation rejected digits from the random UUID. The
failure can vary with the UUID. PostgreSQL was healthy, migrations succeeded,
and the fixture connected and verified `current_database()` before successfully
creating a Clerk user. Organization creation failed before local tenant seeding,
sign-in, page navigation, or business assertions. This is fixture input rejected
by Clerk, with no evidence of bad credentials, a sign-in failure, application
business behavior, a database outage, or an incorrect workflow expectation.

## Changes and review

- `e2e/fixture.ts`: use a plain alphabetic organization name. Unique run/user IDs
  and private ownership metadata still identify and isolate every fixture.
- `scripts/pilot-fixture.test.ts`: exercise the real fixture with mocked provider
  and database boundaries; assert a digit-free name, matching private ownership,
  creator identity, and user/connection cleanup after organization setup failure.
- `src/diagnostics/server.ts`: use platform `crypto.randomUUID()` so the shared
  logger remains usable by both Node and Edge instrumentation. No runtime branch,
  disabled logging, or extra module is needed.
- `src/instrumentation.test.ts`: check the actual hook uses Web Crypto when it
  must generate a request reference. Existing privacy/control-flow tests remain.

Applied Ponytail review to the complete diff, hook/logger callers, fixture setup
and teardown, and both new regressions before final checks. No unresolved
findings. UUID format, sanitized categories, request/digest allowlists, redirect
handling, tenant filtering, private ownership checks and transactional cleanup
are preserved. No new dependencies or workflow assertion changes.

## Verification

- RED: both new tests failed against the original implementation: numeric UUID
  organization name and no call to platform Web Crypto.
- GREEN: all 15 focused fixture/instrumentation/diagnostics tests passed.
- Direct reproduction against the configured Clerk development instance rejected
  the exact original name with the same code and phone-number message, then
  accepted the replacement name for the same synthetic user. Verified ownership
  before deleting both remote fixtures; the probe completed successfully.
- `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, and the isolated
  production build passed on Node 24.20.0 / Next.js 16.4.2. Default tests:
  74 files / 886 tests passed; 15 opt-in PostgreSQL files / 272 cases skipped.
- Applied committed migrations successfully to `afcs_task07_verify` before build.
  The build log contains no warning, `Ecmascript` diagnostic, or Edge import trace.
- Full Playwright scenario passed using installed Chrome, a fresh production
  server, real Clerk development authentication and isolated PostgreSQL:
  one test passed in 1.2 minutes overall. Receipt replay, 4 kg stock, 40 AFN debt,
  25 AFN payment, 15 AFN remaining debt and unchanged stock assertions all remain
  intact. Fixture teardown completed successfully. Only harmless terminal-color
  environment warnings were emitted by the runner.
- `git diff --check` passed. Remote CI is pending the review-branch push.
- The broad opt-in database suites were not rerun: no SQL, schema or application
  business behavior changed; the full provider/database browser scenario passed.

No production data or configuration was changed. Local browser validation uses
the guarded loopback `afcs_task07_verify` database and Clerk development keys;
it does not establish production sign-in or real phone OTP delivery.

Next task: review/merge this fix, then resume Task 34's staging, migration,
backup/restore and monitoring evidence. Task 35 follows; no pilot gate is closed
by this CI fix.
