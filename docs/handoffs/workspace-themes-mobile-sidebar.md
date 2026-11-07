# Light/dark themes and mobile navigation sidebar

Date: 7 November 2026. User-requested UI change; local acceptance complete.
This advances no numbered domain feature. Task 31 remains next.

## Completed behavior

- Shared sun/moon controls in the homepage and workspace navbars switch the
  document between light and dark. The initial theme uses a saved light/dark
  preference, falling back to the device preference. A synchronous root script
  resolves it before paint; CSS controls both the visible icon and accessible
  action label without introducing a second React theme state.
- The choice is saved under `bazardaftar-theme`. Invalid saved values fall back
  to the device preference. Blocked storage still allows switching for the current
  document. The system preference is sampled on page load; there is no additional
  system/automatic mode or cross-tab subscription.
- Paired semantic tokens cover page, panels, sidebar, text, inputs, primary
  actions, success/error and staff accents. Brand foregrounds adapt to the surface.
  Browser theme-color metadata follows the device preference; manual selection
  controls the application colors and CSS color-scheme.
- Below 1024px, a labelled menu icon opens a vertical modal navigation drawer.
  It replaces the horizontal scrolling navbar. The native dialog provides modal
  focus containment and Escape dismissal. Close, backdrop and navigation clicks
  dismiss it; focus returns to the visible trigger. Route changes and resizing to
  desktop close it, releasing the page scroll lock.
- The drawer opens at the leading edge (right for Pashto/RTL, left for English/LTR),
  scrolls its links independently on short screens and retains sign-out at its
  foot. Desktop keeps its sidebar. Both reuse the same permission-filtered links
  and active-route calculation. Language and current location remain available.

## Design, scope and review

Applied the local Taste app-screen, UI/UX Pro Max, frontend direction and
accessibility guidance within ADR 0020. Focused searches covered dark palettes
and modal focus. The existing neutral trading-workspace presentation is retained;
the dark palette uses neutral surfaces and lighter semantic accents. No new style
direction, dependency, provider configuration, database or financial change.

Changed files: root/app layouts and global CSS; shared ThemeToggle and theme
initializer with colocated tests; MobileNavigation and shared AppNavigation with
navigation/layout regression tests; homepage/navbar test; shared Brand; staff
accent token consumer; documentation index and this handoff.

A bounded GPT-6 Luna read-only research pass supported the native-dialog choice.
A separate read-only Ponytail review and main-agent pre-validation review traced
the complete diff, connected layouts/buttons/navigation, role filtering, storage
whitelisting, static script injection boundary, SSR/hydration, dismissal, focus,
desktop resizing and tests. No unresolved must-fix findings were identified.
No server authority or tenant data moves into the new client boundary; only the
existing role string and sign-out slot cross it. The final test-formatting cleanup
was rechecked with lint and its 14-test suite.

## Verification

- RED: new homepage/workspace navbar regressions produced three expected failures
  and 11 passes. Checkpoint: `5618440`. GREEN: five focused suites/39 tests passed;
  implementation checkpoint: `404cb93`.
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` passed.
  Full suite: 69 suites/851 tests passed; 14 opt-in PostgreSQL suites/263 cases
  skipped. No database code changed, so those integration suites were not rerun.
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities.
- 112 hydrated real-component fixtures passed at 1440x900, 768x900, 390x844 and
  320x900 in LTR/RTL and both themes: populated, empty, loading, error, restricted
  role, long business name and signed-in homepage. No horizontal page overflow,
  clipped header controls or uncaught hydration/browser errors. Drawer checks
  cover vertical links, permission filtering, 44px targets, keyboard containment,
  Escape/focus return, close button, backdrop and route selection.
- Additional rendered checks passed for desktop resizing/scroll release,
  reduced-motion navigation, saved preference overriding the device and surviving
  reload, correct accessible toggle labels, and blocked browser storage.
- The running anonymous Next development app passed saved-dark hydration, both
  toggle actions, localStorage persistence/reload and 320px homepage reflow.
  Authenticated workspace evidence uses synthetic Clerk/GT/data/navigation mocks.
- All 48 semantic text/surface pairs and both primary-action pairs meet 4.5:1
  contrast. Desktop/light and narrow RTL/light/dark drawer screenshots were
  inspected. Evidence/scripts are ignored under `artifacts/workspace-themes/`.
- Focused Taste source lint: zero failures and one overlay-shadow warning. The
  shadow belongs to the floating drawer, an allowed use under the app-screen
  rules. This is a focused shell/theme review, not a new whole-dashboard audit.
- The local design evidence record passes the frontend-direction checker.

## Limits and continuation

The build retains the pre-existing diagnostics Edge warning for `node:crypto` in
`src/diagnostics/server.ts`. The local typecheck/build temporarily renamed the
unrelated ignored `artifacts/homepage-navigation-selects/baseline-homepage.tsx`
to `.tsx.txt`, because its old relative import is invalid outside `src`; its
original path was restored after validation. A clean checkout does not contain it.

No coverage tooling was added. Remote CI/review, authenticated live Clerk flows,
Pashto terminology approval and deployed-device behavior remain separate evidence.
The last-resort global error document is standalone and retains its default theme.

**Next numbered task: 31 — rate limits and mutation abuse controls.**
