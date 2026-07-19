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

## Things to try

Change `option.color.blue.600` in `tokens/option.tokens.json` and rebuild — the whole theme (hovers, subtle tints, on-colors, chart palette) follows the brand. Delete a dark-mode value and rebuild to watch fallback behavior. Set a `primary` with poor contrast to see the `TST2101` accessibility warnings.

Note: `expected/` holds the *hand-written* artifacts from the Phase 0 paper exercises, kept for comparison — `expected/shadcn/` from [round 1](../../docs/exercises/phase0-shadcn.md) and `expected/bootstrap/` from [round 2](../../docs/exercises/phase0-bootstrap.md) (no Bootstrap exporter exists yet; those files are the specification its implementation will be checked against). `dist/` is real compiler output. Small value differences between them are expected (the hand-runs used approximated color math) and documented in the exercise reports.
