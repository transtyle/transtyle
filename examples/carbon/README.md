# Carbon — a real design system, adopted

[IBM's Carbon Design System](https://carbondesignsystem.com/elements/color/tokens/) compiled through Transtyle via the [adoption playbook](../../website/src/docs/adopt-existing.md): its published core color tokens live verbatim in `option.*`, its own token vocabulary (`carbon.link-primary`, `carbon.support-error`, `carbon.focus`, …) is expressed as custom semantic tokens with real mode variation, and one small `transtyle.bindings.tokens.json` file maps catalog slots onto that vocabulary.

This is the second half of the **T11 "real-DS run"** (`docs/plan/catalog-revision.md`), alongside [GOV.UK](../govuk/) — two real, independently-designed systems compiled against the same catalog, on purpose: one government, one enterprise-software; one with no dark theme, one with a real one.

## Where the values come from

`tokens/option.tokens.json` transcribes Carbon's **White theme** core tokens (light mode) and the corresponding **G100 theme** values (dark mode) verbatim from [carbondesignsystem.com/elements/color/tokens](https://carbondesignsystem.com/elements/color/tokens/), current as of 2026-07-21 (Blue 60 #0f62fe, Red 60 #da1e28, Green 50 #24a148, Yellow 30 #f1c21b, and the Gray 10–100 scale).

## What's genuinely real here — and what isn't

- **Colors, both modes**: real Carbon core tokens — `$link-primary`, `$support-error/success/warning/info`, `$text-primary/secondary`, `$border-subtle-00`, `$focus` — each with its documented White _and_ G100 value, bound as real per-mode aliases (`$extensions.transtyle.modes`), not derived.
- **Typeface**: real — **IBM Plex Sans** / **IBM Plex Mono**, Carbon's actual open-source, freely-embeddable type family (unlike GOV.UK's licensed font, these load for real in the demo projects).
- **Radius**: real for Carbon's core structural components (buttons, inputs, tiles render square) — Carbon does use small radii on a few components (tags, tooltips) that this single `radius.md` binding doesn't capture; see the findings ledger.
- **Both modes are real Carbon themes**: light = White, dark = G100. Carbon actually ships four themes (White, G10, G90, G100); the catalog's `color-scheme` dimension is binary, so G10/G90 aren't modeled here — a deliberate, documented scope boundary, not an oversight.

## What had to be a judgment call (see the findings ledger)

Carbon has real, named roles for `danger`/`success`/`warning`/`info` (its "Support" token group) _and_ a real named `secondary` (`$button-secondary`) — better 1:1 coverage than GOV.UK. Two things still needed judgment: `neutral` has no dedicated Carbon role (mapped to Gray 60, its general-purpose helper gray), and `secondary`'s dark-mode value falls back to the light value because the G100 theme's `$button-secondary` wasn't independently re-verified against the live source for this pass — flagged rather than guessed. Full reasoning: [`../../docs/findings/carbon-adoption.md`](../../docs/findings/carbon-adoption.md).

## Build it

```bash
npm install        # from the repo root, once
cd examples/carbon
npx transtyle build
```

All seven targets are configured — `shadcn`, `echarts`, `daisyui`, `bootstrap`, `storybook`, `css-variables`, `radix`. `npx transtyle check --json` prints diagnostics + coverage as JSON.

From the **repo root**, without `cd`-ing in: `npm run example:build:carbon` / `npm run example:check:carbon`.

**See it rendered:** [demo/](demo/) — the same seven demo projects as Acme/Cathode/GOV.UK, themed with Carbon's real colors and real IBM Plex fonts. From the repo root:

```bash
npm run dev -w carbon-demo-bootstrap   # port 4401   (also: -daisyui 4402, -shadcn 4403, -echarts 4404, -storybook 6401, -css-variables 4405, -radix 4406)
```
