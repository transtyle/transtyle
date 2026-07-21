# Acme — example design system

The fixture DS from the [Phase 0 paper exercise](../../docs/exercises/phase0-shadcn.md), now compilable for real. It authors only **11 semantic tokens** (brand color, surfaces/text/border with dark values, radius, fonts); the derivation engine fills the rest of the semantic catalog.

## Build it

```bash
# from the repo root, once:
npm install

# then:
cd examples/acme
npx transtyle build shadcn
```

Eight target instances across seven exporters are configured (note the `exporter` field enabling two shadcn instances):

- `npx transtyle build shadcn` → `dist/shadcn/`: Tailwind **v4** era — `globals.transtyle.css` with `:root` + `.dark` + `@theme inline`, OKLCH values.
- `npx transtyle build shadcn-v3` → `dist/shadcn-v3/`: Tailwind **v3** era — HSL channel triplets in `@layer base` plus a `tailwind.theme.transtyle.cjs` snippet to merge into `tailwind.config`.
- `npx transtyle build echarts` → `dist/echarts/`: per-mode **Apache ECharts** theme JSON + self-registering scripts, with an 8-color categorical palette derived from the brand (its first five colors are shared with shadcn's `--chart-*`).
- `npx transtyle build daisyui` → `dist/daisyui/`: daisyUI v5 theme blocks (Tailwind 4).
- `npx transtyle build bootstrap` → `dist/bootstrap/`: Bootstrap ≥5.3, Sass **and** CSS-variable paths.
- `npx transtyle build storybook` → `dist/storybook/`: Storybook chrome ThemeVars + sibling preview composition.
- `npx transtyle build css-variables` → `dist/css-variables/`: the full catalog as plain `--custom-properties` — the plugin-API reference implementation.
- `npx transtyle build radix` → `dist/radix/`: Radix Colors 12-step scales + alpha + contrast — the role grid's own acceptance test.
- `npx transtyle build` builds all eight. Each output includes a generated `usage.md` (paste instructions) and `report.json` (coverage + provenance per variable).

`npx transtyle check` runs the same pipeline without writing files (validation, contrast checks, coverage); `--json` prints a machine-readable report to stdout.

**See it rendered:** [demo/](demo/) contains seven real npm projects — the same fake page in Bootstrap (Sass path), shadcn/ui, daisyUI, and `@radix-ui/themes`, an ECharts dashboard, a minimal themed Storybook, and a plain-CSS-variables page — each consuming only the `dist/` artifacts this example compiles (spec: [docs/specs/demo-app.md](../../docs/specs/demo-app.md)). From the repo root:

```bash
npm run dev -w acme-demo-bootstrap   # port 4101   (also: -daisyui 4102, -shadcn 4103, -echarts 4104, -storybook 6101, -css-variables 4105, -radix 4106)
```

## Things to try

Change `option.color.blue.600` in `tokens/option.tokens.json` and rebuild — the whole theme (hovers, subtle tints, on-colors, chart palette) follows the brand. Delete a dark-mode value and rebuild to watch fallback behavior. Set a `primary` with poor contrast to see the `TST2101` accessibility warnings. Acme also declares a second mode dimension, `density` (`comfortable|compact`, `space.* × 0.875` in compact) — the T8 worked example for multi-dimension modes.

Note on `expected/`: `expected/bootstrap/` and `expected/storybook/` are the Phase 0 **acceptance fixtures** their exporters were verified against when they shipped (2026-07-20: every fixture value matches the real `dist/` output; color values were engine-exact since exercise rounds [6](../../docs/exercises/phase0-bootstrap-rerun.md) and [8](../../docs/exercises/phase0-shadcn-round8.md)). `expected/shadcn/` is different: it is the *historical* hand-written artifact from [round 1](../../docs/exercises/phase0-shadcn.md), superseded as a fixture by the real exporter's own output (`dist/` + `report.json`); its documented deltas vs `dist/` are classified in the [round 5](../../docs/exercises/phase0-shadcn-rerun2.md) report.
