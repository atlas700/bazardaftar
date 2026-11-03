# BazarDaftar

A Pashto-first workspace for grain and mixed-goods wholesalers, starting in
Helmand, Afghanistan. The name pairs **Bazar** with **Daftar** to evoke a market's
business records, with room to serve different kinds of wholesale goods.

Repository: [atlas700/bazardaftar](https://github.com/atlas700/bazardaftar).
The npm package name is `bazardaftar`.

The current application supports business onboarding, staff access, products,
weight units, categories, suppliers, one warehouse, and purchase drafting,
editing, ordering, owner-approved cancellation, and accepted deliveries that
atomically record stock movements and supplier debt. The remaining pilot workflow
adds inventory balances/history, supplier payments, and reconciliation in the order set
out in the [build plan](docs/agent-sized-build-plan.md). Those planned capabilities
are not all implemented. G1 is accepted on retrospective founder evidence under
[ADR 0003](docs/adr/0003-helmand-pilot-workflow.md#amendment--founder-acceptance-of-retrospective-g1-research-1-november-2026);
remaining pilot-release gates stay open.

## Getting started

Use Node.js 24.x and npm. Install the locked dependencies:

```bash
npm ci
```

Configure `.env.local` using `.env.example` and the
[authentication setup](docs/deployment.md#authentication-setup-and-smoke-check)
and [database guide](docs/database.md). Keep credentials out of Git.

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000). Application routes live in `src/app`.
The stack uses Next.js App Router, React, TypeScript, Clerk, and PostgreSQL/Drizzle.
See the [documentation index](docs/README.md) and [project rules](AGENTS.md).

## Validation

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Database integration tests require the dedicated isolated database described in
[Testing](docs/testing.md); a default test run skips them.

## Rename compatibility

BazarDaftar was previously called AFCS (Afghanistan Agricultural Supply Chain OS),
and the repository was `atlas700/code-1`. Historical ADRs and handoffs retain their
original names. Existing `AFCS_TEST_DATABASE_URL`, PostgreSQL names, Clerk
`afcs-` onboarding slugs, and `afcsOnboardingId` metadata remain stable so the
rename does not interrupt existing setups or onboarding recovery. Existing local
checkouts may keep their folder names; the folder name is not the product name.

## Deployment plan

Temporary testing targets Netlify Free and Neon Free with synthetic business
records. Paid production hosting is deferred. Follow the approved targets and
remaining readiness checks in [Deployment](docs/deployment.md) and
[ADR 0018](docs/adr/0018-managed-pilot-hosting.md) before setup.
