# Worklog — P4: hostile-adoption experiment

**Task:** P4 (execution-2026-h2.md) — test W2 by adopting a real product with no design tokens. Findings: [docs/findings/hostile-adoption.md](../findings/hostile-adoption.md).

**Subject chosen:** Miniflux (Apache-2.0 RSS reader), CSS fetched live 2026-07-22. Qualifies as hostile on every axis that matters: 89 CSS custom properties, all component+part+property named, no palette tier, no semantic tier, `#333` under 13 different names, colors/dimensions/font-weights/border-styles mixed in one flat namespace, and literals hardcoded in component rules bypassing the variables entirely.

**Method:** ran the real [adopt-existing playbook](../../website/src/docs/adopt-existing.md) end to end in a scratch dir — option palette, Miniflux-vocabulary semantic tier, binding layer, build all 8 targets — and recorded the cost honestly instead of reporting a success.

## Results

- **Catalog held: zero amendments** (third independent confirmation after T9 Radix and T11 GOV.UK/Carbon). Strong evidence for W3's "expressiveness is not the bottleneck."
- **12% of resolved slots (39/318) trace to Miniflux's real values**; 144 derived, 135 defaulted. Honest ratio for a system that made ~25 colour decisions.
- **5 of 15 bindings were contested** (two competing "primary" blues, three different borders, two muted-text candidates, `red` as the focus ring, an unexplained visited-link hue jump between modes). Irreducibly human — no importer fixes these.

## Two playbook breakages

1. **Named CSS colors are a hard stop.** `red`/`purple` → `TST1106` + cascading `TST1105` dangling aliases; build cannot proceed. Workaround (hand-convert to hex) violates the playbook's own "verbatim" rule. **This reclassifies audit B7** from 🟢 opportunity to a real-adoption blocker — added to the ROADMAP ledger as its own item. `rgb()`/`hsl()` will bite identically.
2. **Step 1 assumes a palette that doesn't exist.** Had to invent a 29-entry palette by deduplicating literals before the playbook's real work could start. Needs an explicit "you have no palette" branch.

## Headline finding

Compiling **exposed a latent defect in the product**: Miniflux's dark mode collapses `danger`/`success`/`info`/`warning` to a single grey (`#efefef` on `#333`). Verified in emitted output — the css-variables dark block emits `oklch(0.952 0 0)` for all four while light keeps them distinct. In the source this is invisible (each var is read by one component, so they never appear side by side). Transcribed faithfully rather than "fixed", so the output tells the truth about the source. Strongest argument for the pivot-language approach found so far.

## Decisions recorded

- **Verdict on W2:** the wedge works; the catalog was never the problem, the on-ramp is. Cheap entry-point fixes (B7, a no-palette playbook branch) buy more adoptability than further mapping work.
- **Phase C order:** I1 (Tailwind) stays ahead of I2 (Figma) — the codebase is where the median product's truth lives. But **neither would have helped Miniflux**; raised a **CSS custom-property importer (I4)** as a candidate, explicitly on one data point, to compete with I1 next planning pass rather than jump it.
- **Not promoted to `examples/`** — would trigger the five-surface obligations incl. 8 demo projects for a fifth example teaching the same pattern. The document is the deliverable; the extraction is reproducible from the cited sources.
