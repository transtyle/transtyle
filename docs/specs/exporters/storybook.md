# Exporter spec: Storybook

**Why it's a reference exporter:** it's not a UI framework — it's a _meta-target_ that documents other targets. It stress-tests two things: theming a tool's own chrome, and composing with sibling exporters' outputs (the vision's "branded documentation" promise, Tier 2 in [doc-generation.md](../doc-generation.md)).

## Compatibility

`"targets": { "storybook": [">=8 <10"] }` — theming API (`ThemeVars` via `@storybook/theming` / `storybook/theming`) verified against current majors at implementation time; profile per major.

## Emitted artifacts

| File                                                                    | Purpose                                                                                                                                                                             |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manager.transtyle.ts`                                                  | `.storybook/manager.ts` content: `addons.setConfig({ theme })` with a generated `create()` ThemeVars object (brand colors, UI surfaces, fonts, radius) — themes Storybook's chrome  |
| `theme.transtyle.ts`                                                    | The ThemeVars object standalone, light + dark variants, for users who compose manager config themselves                                                                             |
| `preview.transtyle.ts`                                                  | Preview annotations: imports sibling-target stylesheets (see below), docs-page theme, backgrounds/​grid values from tokens, a `color-scheme` global toolbar wired to mode switching |
| `tokens.stories.transtyle.tsx` (optional, `options.tokenStories: true`) | Generated token-reference stories: color roles w/ provenance badges, type scale, spacing, shadows — the DS documents itself inside the team's own Storybook                         |
| `usage.md`                                                              | Wiring instructions per Storybook version                                                                                                                                           |

All files are additive fragments the user imports from their existing `.storybook/` config — we never overwrite user config files (generated-file discipline: our files carry the marker header; theirs stay theirs).

## Composition with sibling targets

Unique among exporters: Storybook options may reference other configured targets — `"options": { "previewTargets": ["bootstrap", "shadcn"] }` makes `preview.transtyle.ts` import those targets' emitted stylesheets so the user's stories render under the generated theme. Constraint honored: exporters still can't read each other's _resolutions_ ([plugins.md](../../architecture/plugins.md)) — composition is by _emitted artifact path_, resolved by core from the build manifest and injected via `TargetContext`. This keeps the no-cross-target-coupling invariant while enabling the one legitimate composition case.

`color-scheme` mode → a Storybook global + decorator toggling the mode attribute/class each sibling target documents (`data-bs-theme` for Bootstrap, `.dark` for shadcn — the decorator snippet is assembled from sibling manifests): `native`.

## Mapping strategy (highlights)

- `primary/accent` → `colorPrimary`/`colorSecondary`; `background/surface` → `appBg`/`appContentBg`/`appPreviewBg`; `text*` → `textColor`/`textMutedColor`; `border` → `appBorderColor`; `radius.md` → `appBorderRadius` (px conversion, `approximated` if authored in rem); fonts → `fontBase`/`fontCode`: all `native`.
- ThemeVars is a small, flat surface — most of the design system is _inexpressible in chrome theming_ and that is fine; it flows through preview composition instead. Coverage honestly reports chrome-inexpressible tokens as `dropped (chrome)` while noting preview-path delivery, a case that validated the coverage model's need for per-artifact context.
- `unsupported`: Storybook chrome vars without IR equivalents (e.g. `barSelectedColor` nuances) → sensible role defaults, reported.

## Ground-truth testing

CI boots a fixture Storybook (each supported major) with generated manager/preview/theme files; asserts build succeeds, chrome renders themed (screenshot probes on manager UI), token stories render, and mode toolbar toggles sibling stylesheet behavior.
