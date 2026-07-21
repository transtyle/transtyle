# GOV.UK — a real design system, adopted

The [GOV.UK Design System](https://design-system.service.gov.uk/styles/colour/) — the UK government's public service design system — compiled through Transtyle via the [adoption playbook](../../website/src/docs/adopt-existing.md): its published colour values live verbatim in `option.*`, its own "functional colour" vocabulary (`govuk.brand`, `govuk.error`, `govuk.focus`, …) is expressed as custom semantic tokens, and one small `transtyle.bindings.tokens.json` file maps catalog slots onto that vocabulary. GOV.UK's own names are never renamed into ours.

This is the **T11 "real-DS run"** (`docs/plan/catalog-revision.md`) — proof the catalog holds up against a design system nobody on this project designed, not just Acme (authored for this project) or Cathode (deliberately hostile, but still invented).

## Where the values come from

`tokens/option.tokens.json` is the GOV.UK web palette and the functional-colour set, transcribed verbatim (hex, as published — GOV.UK's own guidance says never hardcode these hexes in a real service, always reference `govuk-colour()`/`govuk-functional-colour()`; this example is a *compiler fixture*, not a service, so the literal values are the whole point) from [design-system.service.gov.uk/styles/colour](https://design-system.service.gov.uk/styles/colour/), current as of 2026-07-21.

## What's genuinely real here — and what isn't

- **Colors**: real, current GOV.UK functional colours (`brand` #1d70b8, `error` #ca3535, `success` #0f7a52, `focus` #ffdd00, and the full text/link/border set).
- **Radius**: real. GOV.UK components render with no border-radius — an authentic, deliberate flat aesthetic, not a fictional quirk.
- **Typeface**: `option.font.transport` names GOV.UK's real fallback stack (`GDS Transport, arial, sans-serif`) — but **GDS Transport itself is a licensed, crown-service-only font** and isn't publicly distributable, so the demo projects render in the `arial` fallback GOV.UK's own CSS specifies for exactly this situation. Not a compiler limitation — a licensing one.
- **Single mode**: GOV.UK's public design system doesn't publish a dark theme, so `modes.color-scheme` declares only `"light"` — legal, and a good demonstration that a mode dimension is optional infrastructure, not a requirement (see `docs/architecture/ir.md#modes`).

## What had to be a judgment call (see the findings ledger)

GOV.UK's functional-colour set doesn't name a `secondary`, `accent`, `warning`, or `info` role the way the catalog's role grid expects — those four are left **unbound**, so they derive from `primary` via the standard rule pack (`derive.js`'s `hue-anchor`/`desaturate-primary` rules). `neutral` and `link.visited` needed a judgment call, mapping onto the closest available web-palette color rather than a named functional one. Full reasoning: [`../../docs/findings/govuk-adoption.md`](../../docs/findings/govuk-adoption.md).

## Build it

```bash
npm install        # from the repo root, once
cd examples/govuk
npx transtyle build
```

All seven targets are configured — `shadcn`, `echarts`, `daisyui`, `bootstrap`, `storybook`, `css-variables`, `radix`. `npx transtyle check --json` prints diagnostics + coverage as JSON.

**See it rendered:** [demo/](demo/) — the same seven demo projects as Acme/Cathode, themed with GOV.UK's real colors instead of a fictional brand. From the repo root:

```bash
npm run dev -w govuk-demo-bootstrap   # port 4301   (also: -daisyui 4302, -shadcn 4303, -echarts 4304, -storybook 6301, -css-variables 4305, -radix 4306)
```
