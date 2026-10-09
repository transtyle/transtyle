# The Mantine exporter

Issue [#72](https://github.com/transtyle/transtyle/issues/72), the first of the exporters the
maintainer scheduled ahead of the P3 pilot on 2026-10-07 (Mantine, Chakra, then MUI;
[backlog](../backlog.md) BL-07). `@transtyle/exporter-mantine` emits one module,
`theme.transtyle.ts`, with a `createTheme()` object and a `cssVariablesResolver` for
`<MantineProvider>`. The mapping study is the Refinement section on the issue, checked against
`@mantine/core@9.7.0` source; the implementation was checked again against 9.7.1, the version the
demos install. Spec: [docs/specs/exporters/mantine.md](../specs/exporters/mantine.md).

## What the source said that the issue had not

The issue proposed a `--mantine-*` override stylesheet next to the theme object, and component
`vars` "as CSS variable overrides (no functions)". Neither survives Mantine's source:

- **The stylesheet would lose.** `MantineProvider` renders its variables in a `<style>` inside the
  React tree, after `<head>`, under `:root[data-mantine-color-scheme="dark"]`. Every variable Mantine
  writes itself beats an override file on specificity and then on source order. The
  `cssVariablesResolver` result is merged over Mantine's own values
  (`get-merged-variables.ts`), so the exporter emits that and no CSS file.
- **`vars` are functions** (`(theme, props) => …`). The data-only routes are `defaultProps` and
  `styles`, and theme `styles` apply before the component's own `vars` output, so they can set the
  size-specific `--button-padding-x-sm` / `--button-height-sm` but not `--button-padding-x` itself.

Three more, found while building the demo rather than in the study:

- **Light-scheme raised surfaces are `--mantine-color-white`.** Cards, inputs, popovers and menus
  read white in light and `dark-6` in dark (48 rules). Without a mapping, Cathode's paper mode put
  pure-white cards on its cream page. The resolver now sets white to `elevation.1.surface` in the
  light block only, because white is also the checkbox tick on filled controls; reported
  `approximated` with that reason.
- **The z-index variables are not read.** `--mantine-z-index-*` appear in no rule of
  `styles.css`; components take their z-index from `getDefaultZIndex()` in JavaScript. The
  refinement had mapped three of them; they are `dropped` instead, since setting them would change
  nothing.
- **The focus ring has no variable.** Every focus outline is `2px solid
var(--mantine-primary-color-filled)`, in the global `.mantine-focus-*` classes and in a dozen
  component rules, so `focusClassName` would only replace the first. `ring` is `dropped`, and the
  ring Mantine draws is the primary solid.

## Measured

`report.json` rows per example, from a fresh build:

| Example | Rows | native | approximated | dropped |
| ------- | ---- | ------ | ------------ | ------- |
| Acme    | 158  | 112    | 38           | 8       |
| Cathode | 166  | 117    | 42           | 7       |
| GOV.UK  | 161  | 111    | 34           | 16      |
| Carbon  | 155  | 111    | 37           | 7       |

Most `approximated` rows are three per role, the per-colour variables whose Mantine meaning differs
from the catalog cell of the same name (`-outline`, `-outline-hover`, `-light-color`). GOV.UK's extra
`dropped` rows are the dark tuple of each role, which a light-only system does not have.

The demo build runs `tsc --noEmit` before `vite build`, so all four emitted themes type-check
against Mantine's own `MantineThemeOverride` and `CSSVariablesResolver` types. Cathode's filled
buttons show its dark `on-solid` text (the `autoContrast` + virtual colour proof the refinement
asked for) in both schemes; checked in a browser on Acme and Cathode, both schemes, including the
modal.

## Deviations from the issue and its refinement

- **No surface inventory yet.** The refinement had Mantine join `check:coverage-bar` with an
  extracted `surface-inventory.json`. That is a separate piece of work (an extraction tool, a drift
  guard, a reconciliation rule for a target that is neither per-variable like Bootstrap nor
  per-family like PrimeNG) and is filed as its own issue. Until it lands, the rows are what the
  exporter classifies, and nothing proves they are the whole surface; the spec and the website
  roadmap say so.
- **The tuple is a table, not a call to the shared ramp projection.** The issue said "after #39",
  so Mantine would never carry a private copy of the projection. #39 has not landed, and Mantine's
  ten steps are all direct cells (no mix), so what the exporter holds is a ten-entry list of cell
  names (`TUPLE`), not a projection algorithm. When #39 lands, Mantine becomes its third consumer
  by passing that list.
- **Spacing and line heights** follow the refinement's rung choices. **Control heights** were not
  in it: the catalog's `size.control.{sm,md,lg}` go to Mantine's `xs/sm/md`, default size to
  default size, because the catalog's `md` and Mantine's `sm` are both the default control (both
  36px unauthored).

## Counts that moved

Exporters 8 → 9 and demos 32 → 36 on the living surfaces (README, examples page, docs index,
homepage, gallery, roadmaps, RELEASING, demo READMEs, the demo-app spec). The dated launch post
keeps its published text and loses its `exporters` and `demos` markers, per the maintainer's rule
for blog posts (2026-10-07). The gallery's title and two sentences now read the target count from
`TARGETS` instead of spelling it.
