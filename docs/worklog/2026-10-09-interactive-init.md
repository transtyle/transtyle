# `transtyle init` asks, with presets and layouts

Issue [#99](https://github.com/transtyle/transtyle/issues/99). `init` wrote one
fixed scaffold and never asked for a brand color. The config declared a dark
scheme, but no neutral had a dark value, so **the scaffold's dark theme was its
light theme**, silently: the first build passed with a single `TST1204` note.

## What changed

- **Five answers, each with a flag.** `--brand`, `--schemes`, `--targets`,
  `--preset recommended|minimal`, `--layout single|layered`, plus `--yes`. In a
  terminal (stdin and stderr both TTYs), the questions no flag answered are asked
  on stderr through `node:readline`; multi-choice answers are numbers or names, so
  no dependency is needed for a picker. Without a terminal nothing is asked and
  stdin is never read.
- **Validated before writing.** Every flag goes through the same validator its
  prompt uses; a bad value exits 2 naming the valid ones, and an existing config
  or token file is never overwritten.
- **`recommended` (the default) writes dark neutrals.** A fixed lightness ladder
  at low chroma in the brand's hue (chroma 0 for a gray brand), light and dark,
  written into the user's file as authored values. The issue said `--yes` keeps
  today's output; the default changed instead (maintainer's decision, 2026-10-05),
  because today's output is the silent light-only dark theme.
- **`--layout` is its own flag** rather than a third preset as the issue
  proposed (maintainer's decision, 2026-10-05), so `minimal`/`recommended` and
  `single`/`layered` combine. `layered` writes the adoption guide's three kinds of
  files: `brand.tokens.json` (palette and `semantic.color.ui.*`, the user's own
  names), `brand.dark.tokens.json`, `transtyle.bindings.tokens.json`.
- **Token files are listed by name**, the dark one as a mode-scoped overlay. The
  old `tokens/*.tokens.json` glob is what led to the double-loaded overlay of
  [#121](2026-10-08-glob-overlay-dedup.md); the loader handles it now, but an
  explicit list also keeps a stray file from joining the base layer.
- **A closing check.** `init` runs the `check` pipeline on what it wrote, prints
  the diagnostics and counts, the brand with its derived `primary.on-solid` and
  their contrast (rounded down, so 4.47:1 never reads 4.5:1), and what to author
  next. Warnings keep exit 0.
- The prompts and the scaffold live in `packages/cli/src/init.js`, a pure
  `scaffold(answers)` and a `promptAnswers(given, targets, { input, output })`
  that takes any streams. `init` stays CLI-only as `cli.md`'s programmatic-parity
  section decided; `@transtyle/core` now exports `parseColor`, which `init`
  validates the brand with.

## Measured

Every preset × layout × schemes combination (8), on all nine targets, with
`#e8590c`: zero errors, zero warnings, no `TST1103`; with dark, one `TST1204` note
(the brand has no dark value, by design: dark brand derivation is #42). The
neutral ladder on `#e8590c`, `#ffe066`, `#0a0a0a`, `#00ff00` and `#7c3aed`: no
contrast warning on a neutral pair in either mode. `#7c3aed` still gets two
`TST2101` on `secondary.on-solid`: the `desaturate-primary` secondary
(`oklch(0.58 0.086 293)`) reaches 4.5:1 with neither on-color. That comes from
derivation, not from what `init` writes, so `init` promises no warning from its
own files, not for every brand. `check-cli` asserts all of the above, the issue's
acceptance command, the exit-2 cases, determinism, and the prompts through
scripted streams; a real pseudo-terminal run was checked by hand.

## Deviations from the issue

- `--yes` writes the new `recommended` scaffold, not the old one (above).
- `layered` is `--layout layered`, not a preset (above).
- `--scales` waits on the option-scale generator (#43); "what to author next" is
  a static list until completeness profiles (#67) land.
