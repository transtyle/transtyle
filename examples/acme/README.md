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

Output in `dist/shadcn/`:

- `globals.transtyle.css` — complete shadcn theme (`:root` + `.dark` + `@theme inline`, Tailwind v4 era). Copy it into a shadcn project; instructions in the generated `usage.md`.
- `report.json` — coverage (native/derived/approximated per variable) and provenance for every value.

`npx transtyle check` runs the same pipeline without writing files (validation, contrast checks, coverage).

## Things to try

Change `option.color.blue.600` in `tokens/option.tokens.json` and rebuild — the whole theme (hovers, subtle tints, on-colors, chart palette) follows the brand. Delete a dark-mode value and rebuild to watch fallback behavior. Set a `primary` with poor contrast to see the `TST2101` accessibility warnings.

Note: `expected/shadcn/globals.transtyle.css` is the *hand-written* artifact from the paper exercise, kept for comparison; `dist/` is the real compiler output. Small value differences between them are expected (the hand-run used approximated color math) and documented in the exercise report.
