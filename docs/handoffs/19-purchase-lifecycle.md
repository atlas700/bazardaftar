# Task 19 — Purchase order editing, ordering, and cancellation

Date: 3 November 2026. Branch: `feat/19-purchase-lifecycle`.
Implementation acceptance is in progress.

## Test-first evidence

- `201e2b8` records eight invalid-command service failures because `mutatePurchase`
  was absent. The isolated PostgreSQL suite then reported 14 missing-lifecycle
  failures alongside 21 existing passing cases. `f6838c3` implements the service;
  the expanded purchase suite passes 41 cases.
- `9b8833e` records four missing `changePurchase` action failures; they pass after
  the service/action implementation.
- `079c8cd` records missing editor/lifecycle UI modules. The intended missing-module
  RED is distinct from an unrelated build/setup failure. The implemented UI passes.
- `29b7455` captures the editor displaying renamed catalogue labels instead of its
  preserved agreement names. Retaining selected supplier/product labels fixes it.
- Ignored `artifacts/task19-purchases/lifecycle-check.cjs` exercises the actual
  hydrated components with mocked actions. With the initial shared lifecycle
  form, typing a cancellation reason and pressing Enter submits `action=order`
  without a confirmation dialog. The check expects zero submissions after a
  dismissed confirmation and observes one. This is native form behavior, not
  live Clerk/provider evidence. Separate action forms and cancellation submission
  confirmation are required before final acceptance.
