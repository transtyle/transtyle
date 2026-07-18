---
title: "Example walkthroughs"
description: "Acme (minimal input) and Cathode (maximal weirdness)."
order: 10
---

# Example walkthroughs

Two example design systems live in the repo, chosen as opposites: Acme shows the **minimal-input** promise; Cathode shows the **maximal-weirdness** tolerance. Between them they exercise every implemented feature.

## Acme — the minimal example

`examples/acme` authors exactly **11 semantic tokens**: a brand blue, background/surface/text/text-muted/border (each with authored dark values), one radius, two font stacks. Plus a 15-token option palette they alias into.

```bash
cd examples/acme
npx transtyle build          # builds both configured instances (v4 + v3 eras)
```

What to study:

- **Derivation in action.** The other 20+ variables in the output are derived: hover/active states, subtle tints, contrast-picked on-colors, `secondary`, `danger`, the chart palette. Grep the output for `· derived`.
- **One brand color drives everything.** Change `option.color.blue.600`, rebuild, and watch the accent tint, on-colors, and all five chart colors follow coherently.
- **Both mode-authoring forms.** Acme uses inline `$extensions` for dark values — the compact form for hand-edited files.
- **Target instances.** Its config builds the same design system for both shadcn eras side by side.
- **A live diagnostic.** Acme's muted text sits near the AA contrast boundary — a deliberate teaching case for `TST2101`.

Acme is also the conformance fixture from the Phase 0 design exercise; `examples/acme/expected/` preserves the original hand-written expected output for comparison against real compiler output.

## Cathode — the hostile example

`examples/cathode` is a retro CRT terminal design system built to attack every default assumption:

- **Alien vocabulary.** Its native language is `crt.ink`, `crt.tube`, `crt.glass`, `crt.scanline`, `crt.amber`, `crt.meltdown` — no "primary" anywhere.
- **Dark-native.** The terminal look is the default mode; light is a paper-printout mode.
- **Brand = text.** Phosphor green is simultaneously `primary` and `text`, and flips polarity across modes.
- **Radius 0, monospace everything.**

```bash
cd examples/cathode
npx transtyle build shadcn
```

What to study:

- **The layered layout.** Three token files, all pure DTCG: `cathode.tokens.json` (source of truth), `cathode.light.tokens.json` (mode overlay — its mode assignment lives in the config), `transtyle.bindings.tokens.json` (catalog → vocabulary aliases). The pattern for real teams whose token files are generated. Restructuring Cathode from inline-extensions form to this layout produced byte-identical output — the equivalence is proven, not claimed.
- **Mode polarity.** `:root` in the output is paper mode, `.dark` is the terminal: exporters bind mode names, not your default flag. Cathode found this bug during development; it's now a stated IR rule.
- **Derivation under stress.** `--primary-foreground` in dark mode is near-black, contrast-picked against glowing green. The chart palette derives green-anchored. `success` derives to hue 150 — nearly phosphor. On a CRT, everything is success.
- **The honest limitation.** Derived `info` is conventionally blue — coherent, wrong for the aesthetic, and fixed by one authored line. Derivation has no taste; that's your job.
- **A CSS curiosity.** `--radius: 0rem` makes shadcn's `calc(var(--radius) - 4px)` negative; browsers reject negative radii and render 0 — the correct brutalist result by accident of CSS.

## Using them as templates

Copy either example's structure for your own system: Acme's two-file shape for solo/hand-maintained systems, Cathode's three-layer shape for teams with generated tokens or split ownership. Then follow the [authoring workflow](/docs/derivation/#practical-workflow): author your opinions, build, read the report, override selectively.
