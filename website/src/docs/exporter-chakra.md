---
title: 'Chakra UI exporter'
description: "A Chakra UI v3 createSystem config: every role a colour palette with Chakra's eight semantic keys, per colour scheme."
order: 17
---

# Chakra UI exporter

<div class="callout live-demos">
  <span class="callout-title">See it live</span>
  <p><a href="/demo/acme/chakra/">Acme</a> · <a href="/demo/cathode/chakra/">Cathode</a> · <a href="/demo/govuk/chakra/">GOV.UK</a> · <a href="/demo/carbon/chakra/">Carbon</a> — one page, four design systems, compiled to Chakra UI. <a href="/demo/">All 44 demos →</a></p>
</div>

[Chakra UI](https://chakra-ui.com/) v3 colours its components through eight semantic keys per palette, each with a light and a dark value, and its recipes read those keys rather than numbered shades. That is [the role grid](/docs/language/#color-roles-the-role-grid) under other names, so this exporter is the closest thing to a rename among the targets. It emits one TypeScript module, `theme.transtyle.ts`, with two exports: `config`, a `defineConfig()` object holding only overrides and additions, and `system`, Chakra's own `createSystem(defaultConfig, config)`.

<!-- measured: acme.chakra.rows = 189 -->
<!-- measured: acme.chakra.native = 146 -->

On [Acme](/docs/examples/) that is 189 classified rows in `report.json`, 146 of them native.

```json
"targets": { "chakra": { "output": "dist/chakra" } }
```

```tsx
import { ChakraProvider } from '@chakra-ui/react';
import { system } from './theme.transtyle';

<ChakraProvider value={system}>
  <App />
</ChakraProvider>;
```

Every role is then a palette: `<Button colorPalette="primary">`, `<Badge colorPalette="success">`, and `<Alert.Root status="error">` reads `danger`. A `.dark` class on `<html>` switches every role to its dark values, through Chakra's own `_dark` condition.

## Colours

Each role becomes `semanticTokens.colors.<role>` with Chakra's eight keys, straight from the grid in each scheme:

| Chakra key   | Grid cell     | Note                                                                           |
| ------------ | ------------- | ------------------------------------------------------------------------------ |
| `solid`      | `solid`       |                                                                                |
| `contrast`   | `on-solid`    |                                                                                |
| `fg`         | `text`        |                                                                                |
| `subtle`     | `tint`        | the lightest wash                                                              |
| `muted`      | `tint-hover`  | **false friend:** a tint depth (the hover of subtle and ghost), not muted text |
| `emphasized` | `tint-active` | **false friend:** the deepest tint, not emphasis                               |
| `border`     | `outline`     |                                                                                |
| `focusRing`  | `ring`        | approximated: Chakra wants one ring per palette, the design system has one     |

Chakra derives its own hovers (`solid/90` for a solid button, `muted` for the softer variants), so the grid's hover, active and selected cells have no key and are reported `dropped`. Custom roles work like built-in ones: [Cathode](/demo/cathode/chakra/)'s `crt-amber` is `colorPalette="crt-amber"`.

The page colours come from the rest of the catalog: `bg` and `bg.panel` from the elevation ladder, `fg`, `fg.muted`, `fg.subtle` from the text rungs, `border` from the border, and `bg.error`, `fg.error`, `border.error` (and warning, success, info) from the status roles. The modal backdrop takes the design system's `scrim`.

## Chakra's defaults read roles, not hues

Chakra's default palette is `gray`, and its Alert hard-codes blue, orange, green and red for its statuses. The exporter points those at the roles of the same meaning: components without a `colorPalette` wear the `neutral` role, and the Alert's `info`, `warning`, `success` and `error` read `info`, `warning`, `success` and `danger`. Chakra's own hue palettes are left alone, so `colorPalette="red"` is still red: the mapping [translates meanings, never names](/docs/language/#false-friends).

## Component geometry

Chakra's recipes already read the semantic routes, `l2` for control radius and the spacing scale for padding, so the [component tier](/docs/language/#the-component-tier) reaches a recipe only when the design system authored something there. [Acme](/demo/acme/chakra/) authors its button layer, so its buttons are pills while its inputs keep the control radius; the other examples author none, and Chakra keeps its own per-size proportions. An authored `component.tooltip.max-width` sets the tooltip's measure. Control heights map `sm`, `md` and `lg` by name.

## What Chakra has no slot for

- **Hover and active colours.** Chakra computes them; see above.
- **Link colours.** Chakra's Link follows the palette it sits in; set `colorPalette="primary"` for brand links.
- **Elevation surfaces 2–5, the categorical palette, border widths, density.** No matching key; each is a `dropped` row with its reason.

The full mapping is in the [exporter spec](https://github.com/transtyle/transtyle/blob/main/docs/specs/exporters/chakra.md). See it running on real Chakra components: `npm run dev -w acme-demo-chakra` (or `cathode-demo-chakra`) in the [examples](/docs/examples/). The demo's build type-checks the emitted config against Chakra's own types before bundling it.
