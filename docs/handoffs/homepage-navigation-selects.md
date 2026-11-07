# Homepage sign-out and Radix language picker

Date: 7 November 2026. User-requested UI fix; local acceptance complete.
This advances no numbered feature. Task 31 remains next in the approved build plan.

## Scope and cause

Signed-in users now have the existing Clerk `SignOut` control beside the homepage
language picker. The server's existing `getSession()` decides visibility; anonymous
users retain sign-in/workspace links and see no sign-out. The header wraps its
controls at narrow widths and uses logical alignment for RTL.

The remaining visible native dropdown was GT's `LocaleSelector` inside the shared
`LocalePicker`. Business forms already used `src/components/ui/select.tsx` and Radix.
The shared picker now uses that same styled trigger, portal menu, selected checkmark,
keyboard navigation and RTL support on the homepage, sign-in, onboarding, staff
access and workspace shell. No business-form conversion was necessary.

`useLocaleSelector()` supplies current/supported locales, display names and GT's
setter. No cookie/router implementation or second locale state was added. Selected
labels are explicit in initial markup, with `bdi`/language attributes. The trigger
has a translated accessible name and 44px target; an empty locale configuration
omits the control. Radix's clipped, hidden form select is not a visible dropdown.

No dependencies, schema, server authorization, financial rules, translation-service
configuration or deployment settings changed.

## Files and review

- `src/app/page.tsx`, `page.test.tsx`: session-aware homepage sign-out and wrapping
  utility group; anonymous/authenticated regression cases.
- `src/app/_components/locale-picker.tsx`, `.test.tsx`: client Radix picker using
  GT's documented hook, current label/direction, setter delegation and empty state.
- `src/components/ui/README.md`: correct the stale NativeSelect component name.
- Documentation index and this handoff.

Applied Ponytail, Context7, Taste, UI/UX Pro Max and accessibility guidance within
ADR 0020. A cheaper GPT-6 Luna agent implemented the bounded navbar/test change;
another inspected selector sources. The main agent verified their findings, owned
the locale migration, refined logical alignment/test mocks and inspected screenshots.
A separate bounded Luna review and main-agent pre-validation review found no
unresolved must-fix issue. Reviewed connected auth wrapper, all picker consumers,
SDK source, shared Radix styles, initial labels, keyboard behavior and form effects.
The final test-only accessibility mock cleanup was rechecked with lint/focused tests.

## Verification

- Baseline tree matched the already validated Task 30 head. Test-first evidence:
  the signed-in homepage test failed without header sign-out; language-picker
  tests failed on the native surface and absent GT setter callback. Both passed
  after implementation. RED checkpoint: `f52167b`; evidence is also recorded here.
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` passed.
  Full suite: 67 suites/837 database-free tests passed; 263 opt-in PostgreSQL cases
  skipped. Final focused check: eight tests passed and lint has no warnings.
  PostgreSQL was not rerun because no database or domain code changed.
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities.
- Six running-app anonymous checks at 1440x900, 390x844 and 320x900 in English/LTR
  and Pashto/RTL: styled open menu, selected option, no overflow, 44px items, no
  visible native control, Escape focus return and actual GT language switching.
  Keyboard selection changes the running app's locale and retains the homepage URL.
  No uncaught browser page errors occurred.
- Twelve real-component fixtures across those widths, both directions and
  signed-in/out states: header controls do not overlap or overflow; portal menus
  stay on screen; the actual shared SignOut component invokes its mocked Clerk
  wrapper with keyboard Enter. This is not a real Clerk session-termination test.
- Desktop signed-in, narrow RTL signed-in and running-app open-menu screenshots
  were visually inspected. Artifacts/scripts/results are ignored under
  `artifacts/homepage-navigation-selects/`.
- Focused picker Taste source lint: zero failures/warnings. Homepage page-mode
  lint reports the same four pre-existing shadow/divider flags on baseline and
  final files, all outside this navbar edit. ADR 0020 and the focused-change rule
  preserve the existing page composition. No new visual direction was needed.
  Whole-page rendered Taste inspection at 1440/768/390 reports seven generic
  marketing-page failures and four warnings (existing eyebrow, shared-control/card
  shadows, dividers, absence of photography/motion, headline scale/wrapping).
  It is not a passing whole-page style audit. Those rules conflict with the retained
  ADR 0020 presentation and exceed this control fix; measured control/layout checks
  and screenshot review above are the acceptance evidence for the requested scope.

## Limits and continuation

Remote CI/review, live authenticated Clerk sign-out, deployed browser behavior and
Pashto terminology approval remain separate. The running local app also emits the
pre-existing Task 30 Edge-instrumentation warning for `node:crypto`; its Node routes
and these UI checks pass. That diagnostics-runtime issue was not changed in this
focused UI fix. No quantitative coverage tooling was added.

The development app remains available at `http://localhost:3000`.
**Next numbered task: 31 — rate limits and mutation abuse controls.**
