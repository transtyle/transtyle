---
title: "Storybook exporter"
description: "Theme Storybook's own chrome and compose sibling targets into the preview — the meta-target."
order: 12
---

# Storybook exporter

Storybook isn't a UI framework — it's the tool that documents your other targets. This exporter themes **Storybook itself** (Storybook 8–9) and wires your sibling targets into its preview. All emitted files are **additive fragments**: you import them from your own `.storybook/` config; we never overwrite user files.

| File | What it does |
|---|---|
| `theme.transtyle.ts` | `create()` ThemeVars objects, one per color-scheme mode (hex output — Storybook's theming pipeline doesn't parse `oklch()`) |
| `manager.transtyle.ts` | `addons.setConfig({ theme })` with the design system's **native mode** — a dark-native DS gets dark chrome (chrome theming is static per boot) |
| `preview.transtyle.ts` | imports sibling targets' stylesheets, adds a **Scheme** toolbar bound to your modes, one decorator that drives every sibling's mode encoding *and* lets the canvas wear your `background`/`foreground`, plus DS-canvas background presets |

```json
"targets": {
  "storybook": {
    "output": "dist/storybook",
    "options": { "previewTargets": ["shadcn", "daisyui"] }
  }
}
```

```ts
// .storybook/manager.ts
import '../dist/storybook/manager.transtyle';
// .storybook/preview.ts
export * from '../dist/storybook/preview.transtyle';
```

## The interesting part: composition without coupling

`previewTargets` names sibling *target instances* from your own config. Core hands the exporter a manifest of sibling **artifact paths** — never their resolved values — so the no-cross-target-coupling invariant holds while `preview.transtyle.ts` still imports `../shadcn/globals.transtyle.css` and toggles `.dark` / `data-theme` / `data-bs-theme` from one decorator. Flip the Scheme toolbar and chrome canvas, sibling stylesheets, and backgrounds all follow.

## Mapping highlights

| ThemeVars | Comes from | Note |
|---|---|---|
| `colorPrimary` / `colorSecondary` | `primary.solid` / `accent.solid` | `colorSecondary` is SB's actual highlight color |
| `appBg`, `barBg` / `appContentBg`, `appPreviewBg` | `elevation.1.surface` / `elevation.0.surface` | the canvas is *your* canvas, not chrome |
| `textColor`, `textMutedColor`, `textInverseColor` | `text.base`, `text.muted`, `text.inverse` | `text.inverse` is the content ladder's own cross-mode rung — the engine's job now, not the exporter's |
| `barHoverColor`, `barSelectedColor` | `primary.solid-hover`, `ring` | first chrome consumers of role states |
| `buttonBg`, `booleanBg` / `booleanSelectedBg` | `neutral.tint` / `elevation.2.surface` | |
| `input*` | `elevation.0.surface`, `border`, `text.base`, `radius.sm` | radii `approximated` (rem→px) |
| `brandTitle` | config `name` (override via `options.brand`) | not a token |
| everything chrome can't express | — | `dropped (chrome)`, delivered through preview composition instead |

Most of a design system is inexpressible in chrome theming — that's fine and honestly reported; it flows through the preview path.

See it running — the demo *is* Storybook's own chrome: `npm run dev -w acme-demo-storybook` (light corporate chrome) or `cathode-demo-storybook` (boots terminal-dark) in the [examples](/docs/examples/).
