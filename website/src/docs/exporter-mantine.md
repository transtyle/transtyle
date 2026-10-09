---
title: 'Mantine exporter'
description: 'A Mantine 9 createTheme object with one virtual colour per role, and a cssVariablesResolver carrying the per-scheme colours.'
order: 16
---

# Mantine exporter

<div class="callout live-demos">
  <span class="callout-title">See it live</span>
  <p><a href="/demo/acme/mantine/">Acme</a> · <a href="/demo/cathode/mantine/">Cathode</a> · <a href="/demo/govuk/mantine/">GOV.UK</a> · <a href="/demo/carbon/mantine/">Carbon</a> — one page, four design systems, compiled to Mantine. <a href="/demo/">All 36 demos →</a></p>
</div>

[Mantine](https://mantine.dev/) themes through one object passed to `<MantineProvider>`: colours are named ten-shade tuples, `primaryShade` picks the filled shade per scheme, and `virtualColor()` lets one name stand for a different tuple in light and in dark. That is [the role grid](/docs/language/#color-roles-the-role-grid) in another shape, so this exporter is mostly a mapping table. It emits one TypeScript module, `theme.transtyle.ts`, with two exports: `theme` and `cssVariablesResolver`.

<!-- measured: acme.mantine.rows = 158 -->
<!-- measured: acme.mantine.native = 112 -->

On [Acme](/docs/examples/) that is 158 classified rows in `report.json`, 112 of them native.

```json
"targets": { "mantine": { "output": "dist/mantine" } }
```

```tsx
import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';
import { theme, cssVariablesResolver } from './theme.transtyle';

<MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver}>
  <App />
</MantineProvider>;
```

Every role is then a colour name: `<Button color="danger">`, `<Badge color="success" variant="light">`, `c="primary"`.

## Why a resolver, and no override stylesheet

Mantine writes its CSS variables **at runtime**, in a `<style>` it renders inside the React tree, after anything in `<head>`. A stylesheet overriding `--mantine-*` variables loses that cascade for every variable Mantine writes itself. The provider's `cssVariablesResolver` result is merged over Mantine's own values instead, so the compiled colours always win. That is the whole reason the output is a resolver and not a CSS file.

## Colours

Each role becomes `virtualColor({ name, light: '<role>-light', dark: '<role>-dark' })` over two ten-step tuples, and an index means the same grid cell in both schemes:

| Index | 0–2                           | 3–4               | 5–7                         | 8      | 9             |
| ----- | ----------------------------- | ----------------- | --------------------------- | ------ | ------------- |
| Cell  | `tint` · `-hover` · `-active` | `outline` · hover | `solid` · `-hover` · active | `text` | `text-strong` |

All ten are direct grid cells, and `primaryShade` is 5, the solid. But Mantine's components don't read tuple positions: they read per-colour variables such as `--mantine-color-danger-filled`, `-light` and `-outline`. The resolver sets each of those per scheme straight from the grid, so every variant shows the compiled colour. Three are honest approximations, because Mantine's variable means something the catalog's same-named cell does not:

| Mantine          | Comes from | Why it is approximated                                                                              |
| ---------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| `-outline`       | `text`     | it is the outline variant's border **and** its label; the catalog's `outline` is too light for text |
| `-outline-hover` | `tint`     | it is a hovered **background**; the catalog's `outline-hover` is a hovered border                   |
| `-light-color`   | `on-tint`  | one variable for text on the tint and on the page                                                   |

`autoContrast` is on, so filled buttons take their text from `--mantine-color-<role>-contrast`, the role's `on-solid`. [Cathode](/demo/cathode/mantine/) shows why that matters: its phosphor-green buttons carry dark text, where Mantine's default would put white on them.

Mantine's two neutral tuples, `gray` and `dark`, are read directly by its stylesheet hundreds of times (borders, inputs, the default variant), so they are filled from the light and the dark neutral ladders, at the positions Mantine's own page variables read.

## What Mantine has no slot for

- **The focus ring.** Mantine draws every focus outline from the primary filled colour, in its stylesheet; `ring` is reported `dropped`.
- **The z-index ladder.** Mantine's components take z-index from JavaScript defaults, not from the `--mantine-z-index-*` variables.
- **Display type, `2xl` breakpoint, link hover/visited, motion, density.** No matching key; each is a `dropped` row with its reason.

Component geometry goes through Mantine's data-only routes, `defaultProps` and `styles`: button and control radius, the default button's horizontal padding, and control heights mapped default size to default size. Inputs and buttons are height-driven, so vertical padding is dropped. The full mapping is in the [exporter spec](https://github.com/transtyle/transtyle/blob/main/docs/specs/exporters/mantine.md).

See it running on real Mantine components: `npm run dev -w acme-demo-mantine` (or `cathode-demo-mantine`) in the [examples](/docs/examples/). The demo's build type-checks the emitted theme against Mantine's own types before bundling it.
