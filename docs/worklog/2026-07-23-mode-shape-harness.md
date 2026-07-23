# Extending the sparse-input harness to mode shapes

`check:minimal-ds` had two axes of coverage and only used one. It varied **which tokens exist** (the three-token floor) but always compiled them under the same `color-scheme: [light, dark]` config. Real configs also come light-only, dark-only, density-only (no `color-scheme` at all), three-valued, and multi-dimension — and an exporter that assumes one particular mode layout would sail past a harness that only ever hands it that layout.

## The sweep

Six legal mode shapes × 8 exporters, running the harness's existing invariants (no crash, no leaked JS value, no empty file, no over-claimed coverage) on each:

| shape           | `modes`                                                      |
| --------------- | ------------------------------------------------------------ |
| `light-dark`    | `color-scheme: [light, dark]` (the original)                 |
| `light-only`    | `color-scheme: [light]`                                      |
| `dark-only`     | `color-scheme: [dark]`                                       |
| `density-only`  | `density: [comfortable, compact]` — no `color-scheme` at all |
| `three-scheme`  | `color-scheme: [light, dark, dim]`                           |
| `two-dimension` | `color-scheme` + `density`                                   |

**All clean — 136 emitted files, no crash, no leak, no false coverage.** The AL5 defensiveness holds across mode layouts too: a light-only DS doesn't crash for want of a `dark` map, a density-only DS has no `modes.light` alias at all and every exporter still produces valid output. That is worth locking in even though nothing broke — the previous harness simply never asked.

## The one real bug: the polarity axis has to be first

The shape the sweep does **not** wave through is `density`-first — `color-scheme` declared, but after another dimension. Compiled against every exporter, all of them emitted a dark _block_ (`.dark`, `[data-bs-theme=dark]`, `[data-color-scheme=dark]`) filled with **light values**. The authored dark surface was dropped.

Traced to a single fact: the engine treats the **first** dimension as the light/dark polarity axis. `derive.js` computes `isDark` off `modeDimension` (which is `dimEntries[0]`), and the back-compat `modes.light` / `modes.dark` aliases exporters bind are only created for the _primary_ dimension's values. So with `density` first:

- the authored dark values still land correctly in their combos (`comfortable+dark` surface really is `#101114` — NORMALIZE resolves per-dimension regardless of order),
- but no `modes.dark` alias is created, so every exporter reads `modes.dark === undefined` and falls back to light,
- and **nothing warned**. Silently wrong output — exactly the AL5 failure class.

There is no coherent "just make it work" fix, because even if the alias pointed at the right combo, `isDark` would still be false for a non-primary `color-scheme`, so derived dark values (hover states, elevation) would compute as light. The whole engine assumes polarity is the first dimension. The right move is to make that assumption explicit and loud.

**New diagnostic `TST1112`** (warning): raised in NORMALIZE when `color-scheme` is declared but is not the first dimension —

```
⚠ TST1112 "color-scheme" is declared but "density" is the first mode dimension —
  light/dark is bound to the first dimension, so this design system's dark mode
  will not reach any exporter.
  ↳ List "color-scheme" first in `modes`. Only the first dimension carries
    light/dark polarity; the others are extra axes exporters mostly drop.
```

Fires only for the mistake: single-dimension configs, `density`-only, `color-scheme`-first + `density`, and dark-only all stay silent.

## Locked in

The harness now loops the four invariants across all six shapes, and adds a negative-space case asserting `density`-first raises `TST1112` — verified by disabling the diagnostic and watching the harness name the gap. Documented on the diagnostics page (`check:docs` derives the code set from source, so an undocumented code would have failed the build) and in `configuration.md`'s `modes` section, where "the first dimension carries light/dark" is now stated as a constraint next to the existing one-dimension-per-layer rule.

`check:all` green at 63.
