# Task 18 — Purchase order drafts

Date: 2 November 2026. Branch: `feat/18-purchase-drafts`.
Implementation in progress; final acceptance and review delivery pending.

## Test-first and review evidence

- `c6df751` and `e3ab27b`: missing service/action and PostgreSQL service imports
  fail before implementation. `a8f08ee`: valid missing-detail-module UI RED;
  earlier UI setup failures are not counted as feature evidence.
- `a9c33fb`: an actual PostgreSQL near-half-cent ratio rejects the correct
  `0.00` total because division rounds the intermediate ratio to a tie. Migration
  0009 uses exact quotient/remainder half-up arithmetic. The regression passes.
- `69230d0` captures whole quantity `10` displaying as `1` and price overflow
  highlighting quantity. `c73605b` fixes both; UI and database regressions pass.
- Hydrated actual-form check in ignored `artifacts/task18-purchases/check.cjs`
  fails after invalid submission: supplier/product/measure selectors become
  `Choose…` while quantity/price remain. A second submission cannot proceed.
  The assertion expects `Helmand Grain`, receives `Choose…`. This is real native
  form-reset behavior with a mocked action, not live provider evidence.

Next: finish the form recovery fix, review connected code, complete local
acceptance, and deliver the PR. Task 19 follows this task; Task 16 remains deferred.
