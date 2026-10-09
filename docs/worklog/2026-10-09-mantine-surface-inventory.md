# Mantine's surface inventory

Issue [#156](https://github.com/transtyle/transtyle/issues/156), the follow-up the Mantine exporter
([#155](https://github.com/transtyle/transtyle/pull/155)) filed as a deviation: Mantine shipped
without a checked-in surface inventory, so `check:coverage-bar` covered Bootstrap and PrimeNG only,
and nothing proved the exporter's rows were the whole of Mantine's theming surface.

## What was built

- `packages/exporter-mantine/tools/extract-surface.mjs` reads the installed `@mantine/core` (9.7.1,
  a demo dependency) and writes `surface-inventory.json`: 203 entries in four families, the 73
  leaves of `DEFAULT_THEME` (minus `variantColorResolver`, `components`, `other`) and the 80 / 25 /
  25 variables `defaultCssVariablesResolver` writes in its `variables`, `light` and `dark` blocks.
  Per-colour variables and palettes are folded into `<color>` entries, as the issue asked.
- Each variable records `from`, what it is computed from, measured by changing one theme leaf at a
  time and re-running the resolver, plus the `var(--…)` the value references.
- `packages/exporter-mantine/src/surface-coverage.js`, shared by the exporter and the check,
  classifies every entry as set, follows, or kept on Mantine's default with a reason; the exporter
  adds the resulting rows to `report.json`. The inventory joins the package `files` allowlist.
- `scripts/check-coverage-bar.mjs` gains the drift guard (a fresh extraction must equal the file;
  the message names the version or the entries that moved, and the regenerate command) and the
  Mantine reconciliation rule: per-family arithmetic like PrimeNG's, and a named row with a note for
  every entry kept on Mantine's default, like Bootstrap's per-variable rows. The issue asked for a
  shape of its own; this one is the two existing ones put together, because Mantine's surface is
  small enough to name every gap and structured enough (theme object, three resolver blocks) to sum.
- The `unsupported` entry rows carry the `meaning` keys of the catalog-signals report (#168, which
  landed while this was in progress): `target.config` and `color.named-palette` (target-specific),
  `color.gradient` and `type.text-wrap` (open, single-source). `gen-catalog-signals.mjs` counts the
  named entry rows and skips the family summaries; the page now lists Mantine among the exporters
  that inventory their whole surface.
- `check-doc-numbers.mjs` gains `<example>.mantine.<set|follow|default>`, read off the exporter's
  totals row like PrimeNG's split.

## Findings

- **Most of Mantine's variables are references, not values.** `--mantine-color-dimmed` is
  `var(--mantine-color-gray-6)`, `--mantine-primary-color-filled` is
  `var(--mantine-color-blue-filled)`. Probing the theme alone found no dependency for 41 of the 130
  variables (7 of them are constants: the z-index ladder and the scheme names); the `var()`
  references had to be recorded too. The other way round, a reference the
  theme value carries (`fontSizes.xs` is `calc(0.75rem * var(--mantine-scale))`) is not a
  dependency, since a theme that sets `fontSizes.xs` replaces the reference with it; without that
  exclusion every size read as stuck on `--mantine-scale`.
- **Four palettes are structural, not two.** The spec named `gray` and `dark` as the neutral
  tuples Mantine's stylesheet reads. The extractor's own test (does anything other than the
  palette's own variables read it?) also finds `red` (`--mantine-color-error`) and `teal`
  (`--mantine-color-success`). Folding them into `<color>` would have let the role palettes this
  theme adds stand for the ones Mantine's page reads, the over-claim PrimeNG's bar already rejected
  once (its "exact match only" rule).
- **Mantine's colour namespace is ambiguous.** With a `primary-light` tuple next to the `primary`
  virtual colour, `--mantine-color-primary-light-color` parses as either. The first classification
  read it the wrong way and reported every role's `-light-color` and `-light-hover` as Mantine's
  default; the collapse now has to end in a variant suffix the inventory knows.
- **What stays Mantine's.** On Acme, Cathode and Carbon: 31 entries, none a catalog gap a design
  system could fill today. They are behaviour switches (`focusRing`, `cursorType`,
  `respectReducedMotion`, …), slots with no catalog concept (`headings.textWrap`, the gradient
  variant, `scale`, `luminanceThreshold`), `white`/`black` and the `red`/`teal` palettes (the
  colours they seed are set directly), the unread z-index variables (`dropped`) and the two
  scheme names. GOV.UK keeps 60: its missing dark scheme (one shared reason) and `font.mono`.

## Measured

| Example | Report rows | Set | Follow | Mantine's default |
| ------- | ----------- | --- | ------ | ----------------- |
| Acme    | 194         | 106 | 66     | 31                |
| Cathode | 202         | 106 | 66     | 31                |
| GOV.UK  | 227         | 80  | 63     | 60                |
| Carbon  | 192         | 106 | 66     | 31                |

Rows grew by 36 to 66 per example (four family rows, the named defaults and the totals row); the
measured markers on the Mantine page moved with them (Acme 158 → 194 rows, 112 → 116 native).

The check was broken on purpose three ways and restored: an entry removed from the inventory (the
drift guard names it, and every example's `theme` family count no longer matches), the recorded
version bumped to 9.8.0 (the drift guard names both versions), and one reason removed from
`REASONS` (every example fails with the entry's id and where to add the reason).

## A catch-all for minimal design systems

`check:minimal-ds` compiles 1- and 3-token design systems through every exporter. Those leave most
of the theme unset (no type scale, no radii), and with reasons written only for what the four
examples leave unset, their reports would carry dozens of `unsupported` rows with no note. Entries
with no reason of their own now get a shared one ("this design system defines nothing the exporter
maps to this entry"), and `check:coverage-bar` refuses that note on the four examples, so an entry
new in a Mantine upgrade still fails there until it gets a real reason.

## Not in this inventory

The per-component CSS-module variables (`--button-*`, `--input-*`, …): each component's `vars`
function computes them from props, not from the theme, and the exporter reaches the few it can
through `styles`. The spec says so.
