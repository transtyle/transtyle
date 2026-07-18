# Cathode — a deliberately hostile example

A retro CRT terminal design system whose native language contains no "primary", no "secondary", no light-first assumption — built to prove that an uncommon design system still compiles cleanly through the semantic catalog.

## What's weird about it

- **Its own vocabulary.** The DS speaks in `crt.ink`, `crt.tube`, `crt.glass`, `crt.scanline`, `crt.amber`, `crt.meltdown`. These live as *custom semantic tokens* — legal in the IR, carried with full provenance.
- **Dark is native.** The terminal look is the default mode; "light" is a paper-printout mode. (`modes.color-scheme.default: "dark"`.)
- **The brand color is the text color.** Phosphor green is simultaneously `primary` and `text` — and it flips polarity across modes (glowing green on black ↔ ink green on paper).
- **Radius 0, monospace as the "sans" font.**

## The binding-layer pattern (the actual lesson)

The catalog slots are one-line aliases into the DS's own vocabulary:

```jsonc
"crt": { "ink": { "$value": "{option.color.phosphor.green}", /* + light-mode value */ } },
"primary": { "base": { "$value": "{semantic.color.crt.ink}" } },
"text":    { "base": { "$value": "{semantic.color.crt.ink}" } }
```

The design system thinks in its own language; the catalog is only the *compilation contract*. Note that mode variation lives on the vocabulary tokens (`crt.ink` knows its paper form), so every catalog binding stays a pure alias.

## Build it

```bash
npx transtyle build shadcn   # → dist/shadcn/globals.transtyle.css
```

Things to observe in the output:

- `:root` is **paper mode**, `.dark` is the **terminal** — shadcn's structure is light-first, and the exporter binds mode *names*, not the DS's default flag. (This example found that bug; see the mode-polarity rule in `docs/architecture/ir.md`.)
- `--primary-foreground` in dark mode is near-black — contrast-pick against glowing green, derived, correct.
- Everything the DS didn't author (secondary, subtle tints, hover states, the chart palette) derives green-anchored: the data-viz palette starts at phosphor and rotates from there.
- `--radius: 0rem` makes shadcn's `--radius-sm: calc(var(--radius) - 4px)` negative; browsers treat negative radii as invalid and render 0 — the correct brutalist result, by accident of CSS. A future `check` rule could warn here.
- Amusing: `success` derives to hue 150 — nearly phosphor green. On a CRT, everything is success.

## Honest limitations this example exposes

Derived `info` is blue — jarring on a monochrome terminal aesthetic. Derivation guarantees *coherence*, not *art direction*: a real Cathode maintainer would author `info: {crt.amber}` (one line). That boundary — deterministic rules produce defensible defaults, humans own taste — is by design (ADR-0005).
