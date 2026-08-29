---
title: 'Example walkthroughs'
description: 'Acme (minimal input), Cathode (maximal weirdness), and two real, independently-designed systems: GOV.UK and Carbon.'
order: 10
---

# Example walkthroughs

Four example design systems live in the repo. Acme and Cathode are invented, chosen as opposites — minimal input vs. maximal weirdness. [GOV.UK](#govuk--a-real-design-system) and [Carbon](#carbon--a-real-design-system) are real, published, independently-designed systems adopted through the same [binding-layer playbook](/docs/adopt-existing/) — the project's **T11 "real-DS run"**, proof the catalog holds up against systems nobody on this project designed.

## Acme — the minimal example

`examples/acme` authors **26 tokens above the raw palette**, and only nine of them are the design decisions: a brand blue, background/surface/text/text-muted/border (each with authored dark values), one radius, two font stacks. The other seventeen are an explicit 13-step space scale and four component-tier tokens, both there to exercise machinery rather than because the system needs them spelled out. Plus a 14-token option palette they alias into.

```bash
cd examples/acme
npx transtyle build          # shadcn (v4 era), shadcn-v3, daisyui, echarts, bootstrap, storybook, css-variables, radix, primeng
```

What to study:

- **Derivation in action.** The other 20+ variables in the output are derived: hover/active states, subtle tints, contrast-picked on-colors, `secondary`, `danger`, the chart palette. Grep the output for `· derived`.
- **One brand color drives everything.** Change `option.color.blue.600`, rebuild, and watch the accent tint, on-colors, and all five chart colors follow coherently.
- **Both mode-authoring forms.** Acme uses inline `$extensions` for dark values — the compact form for hand-edited files.
- **Target instances.** Its config builds the same design system for both shadcn eras side by side — plus [per-mode ECharts themes](/docs/exporter-echarts/) whose `color[]` palette shares its first five colors with shadcn's `--chart-*`: one brand, one data-viz palette, everywhere.
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
npx transtyle build          # same seven targets as Acme, radically different values
```

What to study:

- **The layered layout.** Three token files, all pure DTCG: `cathode.tokens.json` (source of truth), `cathode.light.tokens.json` (mode overlay — its mode assignment lives in the config), `transtyle.bindings.tokens.json` (catalog → vocabulary aliases). The pattern for real teams whose token files are generated. Restructuring Cathode from inline-extensions form to this layout produced byte-identical output — the equivalence is proven, not claimed.
- **Mode polarity.** `:root` in the output is paper mode, `.dark` is the terminal: exporters bind mode names, not your default flag. Cathode found this bug during development; it's now a stated IR rule.
- **Derivation under stress.** `--primary-foreground` in dark mode is near-black, contrast-picked against glowing green. The chart palette derives green-anchored — build the ECharts target and open the dark theme: phosphor-green series on tube-black, a dashboard from 1983. `success` derives to hue 150 — nearly phosphor. On a CRT, everything is success.
- **The honest limitation.** Derived `info` is conventionally blue — coherent, wrong for the aesthetic, and fixed by one authored line. Derivation has no taste; that's your job.
- **A CSS curiosity.** `--radius: 0rem` makes shadcn's `calc(var(--radius) - 4px)` negative; browsers reject negative radii and render 0 — the correct brutalist result by accident of CSS.

## GOV.UK — a real design system

`examples/govuk` adopts the [GOV.UK Design System](https://design-system.service.gov.uk/styles/colour/) — the UK government's public-service design system — via the binding-layer pattern: its published colors live verbatim in `option.*`, its own "functional colour" names (`govuk.brand`, `govuk.error`, `govuk.focus`, …) are custom semantic tokens, and `transtyle.bindings.tokens.json` maps catalog slots onto them.

```bash
cd examples/govuk
npx transtyle build          # same seven targets as Acme/Cathode
```

What to study:

- **A clean 1:1 mapping, found by accident.** GOV.UK's iconic yellow keyboard-focus color maps directly onto the catalog's `ring` slot — no judgment call needed.
- **Honest gaps.** GOV.UK's functional-colour set has no distinct `secondary`, `accent`, `warning`, or `info` role — those four are left unbound and derive from `primary` via the standard rule pack, exactly the "don't translate everything on day one" guidance in the [adoption playbook](/docs/adopt-existing/).
- **A single-mode config, on purpose.** GOV.UK's public system has no published dark theme, so `modes.color-scheme` declares only `"light"` — legal, and proof a mode dimension is optional infrastructure, not a requirement.
- **A licensing limitation, not a compiler one.** GOV.UK's real typeface (GDS Transport) is licensed to crown services only; the demo projects render in GOV.UK's own documented `arial` fallback instead.
- **Radius 0 is authentic here too** — but for a different reason than Cathode: it's GOV.UK's actual, deliberate flat aesthetic, not an invented quirk.

Full reasoning for every binding decision: [`docs/findings/govuk-adoption.md`](https://github.com/julien-deramond/transtyle/blob/main/docs/findings/govuk-adoption.md).

## Carbon — a real design system

`examples/carbon` adopts [IBM's Carbon Design System](https://carbondesignsystem.com/elements/color/tokens/) the same way, alongside GOV.UK on purpose: one government system with no dark theme, one enterprise system with a real one.

```bash
cd examples/carbon
npx transtyle build          # same seven targets
```

What to study:

- **Better native role coverage than GOV.UK.** Carbon has real, named tokens for `danger`/`success`/`warning`/`info` (its "Support" group) _and_ a real `secondary` (`$button-secondary`) — bound directly, not derived.
- **Real per-mode tokens, not synthetic dark mode.** Carbon ships four themes (White, G10, G90, G100); this example binds White → light, G100 → dark, with every color's actual documented value in both modes via `$extensions.transtyle.modes` — `$focus`, `$link-primary`, and the four Support colors all have real, distinct light/dark values.
- **A genuinely open type system.** IBM Plex Sans/Mono are open-source and load for real in the demo projects — unlike GOV.UK's licensed font.
- **A flagged, not guessed, gap.** `secondary`'s dark-mode value falls back to its light value because Carbon's G100 `$button-secondary` wasn't independently re-verified against the live source for this pass — the honest alternative to inventing a plausible-looking hex.

Full reasoning: [`docs/findings/carbon-adoption.md`](https://github.com/julien-deramond/transtyle/blob/main/docs/findings/carbon-adoption.md).

## See the themes on real frameworks

Each example ships eight npm-runnable **demo projects** (`examples/<example>/demo/<target>/`) — the same fake page in real [Bootstrap](/docs/exporter-bootstrap/) (Sass path), real [shadcn/ui](/docs/exporter-shadcn/) registry components, [daisyUI](/docs/exporter-daisyui/), [`@radix-ui/themes`](/docs/exporter-radix/), and Angular [PrimeNG](/docs/exporter-primeng/); an [ECharts](/docs/exporter-echarts/) dashboard; a minimal [Storybook](/docs/exporter-storybook/) whose own chrome wears the theme; and the plain [css-variables](/docs/exporter-css-variables/) reference page. That's 32 projects across the four examples, every one consuming only the compiled `dist/` artifacts, and every one built in CI. From the repo root: `npm run dev -w acme-demo-bootstrap` (ports 4101–4107, 6101; Cathode: 4201–4207, 6201; GOV.UK: 4301–4307, 6301; Carbon: 4401–4407, 6401).

## Using them as templates

Copy any example's structure for your own system: Acme's two-file shape for solo/hand-maintained systems, Cathode's three-layer shape for teams with generated tokens or split ownership, GOV.UK/Carbon's binding-layer shape for adopting an existing published system without renaming it. Then follow the [authoring workflow](/docs/derivation/#practical-workflow): author your opinions, build, read the report, override selectively.
