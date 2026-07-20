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

Three targets are configured (note the `exporter` field enabling two shadcn instances):

- `npx transtyle build shadcn` → `dist/shadcn/`: Tailwind **v4** era — `globals.transtyle.css` with `:root` + `.dark` + `@theme inline`, OKLCH values.
- `npx transtyle build shadcn-v3` → `dist/shadcn-v3/`: Tailwind **v3** era — HSL channel triplets in `@layer base` plus a `tailwind.theme.transtyle.cjs` snippet to merge into `tailwind.config`.
- `npx transtyle build echarts` → `dist/echarts/`: per-mode **Apache ECharts** theme JSON + self-registering scripts, with an 8-color categorical palette derived from the brand (its first five colors are shared with shadcn's `--chart-*`).
- `npx transtyle build` builds all three. Each output includes a generated `usage.md` (paste instructions) and `report.json` (coverage + provenance per variable).

`npx transtyle check` runs the same pipeline without writing files (validation, contrast checks, coverage).

**See it rendered:** [examples/demo-app/](../demo-app/) shows the same fake app themed by these outputs in Bootstrap (fixture), daisyUI, and shadcn, side by side — open `examples/demo-app/index.html`.

## Things to try

Change `option.color.blue.600` in `tokens/option.tokens.json` and rebuild — the whole theme (hovers, subtle tints, on-colors, chart palette) follows the brand. Delete a dark-mode value and rebuild to watch fallback behavior. Set a `primary` with poor contrast to see the `TST2101` accessibility warnings.

Note on `expected/`: `expected/bootstrap/` and `expected/storybook/` are **acceptance fixtures** for the exporters that don't exist yet — their color values are engine-exact (regenerated in exercise rounds [6](../../docs/exercises/phase0-bootstrap-rerun.md) and [8](../../docs/exercises/phase0-shadcn-round8.md)); non-color values are hand-derived against specced-but-unimplemented rules. `expected/shadcn/` is different: it is the *historical* hand-written artifact from [round 1](../../docs/exercises/phase0-shadcn.md), superseded as a fixture by the real exporter's own output (`dist/` + `report.json`); its documented deltas vs `dist/` are classified in the [round 5](../../docs/exercises/phase0-shadcn-rerun2.md) report.
