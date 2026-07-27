# Sweeping `autoDark` in the minimal-ds harness

The previous commit (18c1d19) implemented `autoDark`'s provenance
reclassification and verified it manually — a probe script, run once, checked
by hand. Nothing regression-tested it. `check-minimal-ds.mjs` already sweeps
two axes of sparseness (the token set, the mode shape); `autoDark` is a third,
and until now the harness never set it at all.

## What changed

Every shape/exporter combination in the sweep now runs twice: once with
`derivation.autoDark: false` (today's default, unchanged), once with `true`.
`writeConfig` takes the flag and threads it into `derivation`. 272 files
compiled now, up from 136.

Two new invariants, both scoped to `extraValues.length` (the three shapes with
a fixture-backed non-default `color-scheme` value: `light-dark`,
`three-scheme`, `two-dimension` — the only ones where a carry-over exists to
reclassify at all):

- **7 (IR boundary):** for every authored extra scheme value — not just
  `dark`, `three-scheme`'s `dim` too, proving the tagging isn't accidentally
  keyed to the literal string `"dark"` — `semantic.color.primary.solid`'s
  `provenance.kind` must be `derived` when `autoDark` is on, `authored` when
  it's off. When on, also checks the `rule` trace is present.
- **6b (real exporter output):** for `css-variables` specifically, the dark
  block's `--color-primary-solid` line must carry a `derived` comment when
  `autoDark` is on. Checking only the IR would miss a regression that flips
  the internal flag but never wires it into what an exporter renders — which
  is exactly the gap between "correct in principle" and "correct in the
  artifact users audit."

Both verified to actually bite: reverted `normalize.js`'s provenance branch to
always tag `authored` (simulating the regression these invariants exist to
catch) and confirmed both fired — 35 failures across every exporter × shape ×
value combination, independently from both the IR check and the emitted-CSS
check on `css-variables`.

`check:all` green at 63; `check:minimal-ds` alone still runs in well under a
second.
