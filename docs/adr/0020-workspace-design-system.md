# ADR 0020 — Apple-inspired workspace with shadcn/ui primitives

- Status: Accepted
- Date: 31 October 2026

**Current gate note — 5 November 2026:** G1 was accepted on 1 November under
[ADR 0003's amendment](0003-helmand-pilot-workflow.md#amendment--founder-acceptance-of-retrospective-g1-research-1-november-2026).
The G1/Task 15 statements below describe the redesign's 31 October context. Its
design contract remains applicable; the
[build plan](../agent-sized-build-plan.md#current-gate-status) owns current delivery readiness.

## Context

The founder explicitly requested a comprehensive visual redesign of the current
app, research into Apple's design system, reusable form components, and Zod
validation, with shadcn/ui as the component option. Task 15 was explicitly excluded.
The existing application repeats raw control styles and presents unfinished
workflows as generic placeholders.

## Decision

Use [Apple's Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)
as design guidance for this web application, with adapted MIT-licensed
[shadcn/ui components](https://ui.shadcn.com/docs/components) as the control layer.
This is an independent web adaptation, not an Apple component library or a native
Liquid Glass implementation.

- Apply the [layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout):
  aligned lists, grouped settings, leading-edge hierarchy, and progressive disclosure.
- Apply the [typography guidance](https://developer.apple.com/design/human-interface-guidelines/typography):
  system fonts, a compact hierarchy, and readable regular/medium weights. Use the
  platform's available font; do not distribute Apple's font files or SF Symbols.
- Follow [materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials)
  with restrained layering. Keep records and forms on opaque, legible surfaces.
- Share Button, Input, NativeSelect, Field, loading/error feedback, page headings,
  panels, and status badges. Use CSS-first Tailwind 4 tokens, a light neutral
  palette, blue primary actions, semantic status colors, and Lucide icons.
- Keep native forms, `useActionState`, HTML validation, and existing authoritative
  server-side Zod schemas. Do not add a second form-state library or duplicate the
  business schemas in the client. Show server validation against the relevant
  fields, preserve values, disable pending mutations, and keep safe recovery text.
- Preserve server-derived authority, provider authentication, permissions,
  transaction handling, exact numeric policies, route guards, and business data.

## Design contract and verification

The primary job is to manage existing products, measures/categories, and staff.
The catalogue list takes priority over its creation form. Settings group related
destinations. The overview links to existing capabilities and labels future work
honestly; it displays no fabricated balances or operational metrics.

Target viewports: 390x844 and 1440x900, with an additional 320px reflow check.
Use logical spacing/borders for Pashto RTL, wrap long identifiers, provide 44px
controls, visible keyboard focus, linked labels/errors, and reduced-motion styles.
Check populated, empty, loading, error, partial/inactive-reference, success, and
permission states. Keep local rendered artifacts separate from live provider
evidence. An unauthenticated visual fixture does not prove authenticated browser
interaction, provider delivery, translated-label quality, or database mutations.

## Consequences

The component dependencies and provenance are explicit in `package.json`, its
lockfile, `components.json`, and `src/components/ui/README.md`. Visual changes
require lint, typecheck, tests, production build, and a dependency audit.
No schema migration, new domain workflow, or deployment is authorized here.
G1 stays open, and Task 15 and later remain subject to the existing gates.
