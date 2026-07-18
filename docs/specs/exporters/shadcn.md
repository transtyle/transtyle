# Exporter spec: shadcn/ui

**Why it's a reference exporter:** the semantic-token-native target — shadcn's theme *is* a set of semantic CSS variables (`--background`, `--primary`, `--muted`, `--destructive`, `--radius`…), so it exercises the IR's semantic catalog almost 1:1 and is the cleanest test of mode handling (light/dark classes). Also the most-demanded target in the current ecosystem.

## Moving-target caveat

shadcn/ui is a copy-paste component collection, not a versioned library — "versions" are CLI/registry eras, and its variable set shifted with the Tailwind v3→v4 transition (HSL channel triplets vs OKLCH values, `tailwind.config` vs CSS `@theme`). Profiles therefore track **eras, not semver**: a `tailwind-v3` profile and a `tailwind-v4` profile, selected via target option (`"options": { "era": "tailwind-v4" }`). The exporter README documents this deviation from normal version selection. Verify the current variable set against shadcn's theming docs at implementation time.

## Emitted artifacts (tailwind-v4 profile)

| File | Purpose |
|---|---|
| `globals.dsx.css` | `:root` + `.dark` blocks defining the full shadcn variable set in OKLCH; `@theme inline` block wiring tokens to Tailwind utilities |
| `usage.md` | Where to paste/import, how it interacts with `components.json`, coverage summary |

(tailwind-v3 profile: HSL channel-triplet variables + a `tailwind.config` theme-extension snippet instead of `@theme`.)

## Mapping strategy (highlights)

- `background/surface/overlay` → `--background`, `--card`, `--popover`: `native`. `text`/`text-muted` → `--foreground`, `--muted-foreground`: `native`.
- `primary` + `text-on-primary` → `--primary`/`--primary-foreground`: `native` — shadcn's paired `-foreground` convention maps exactly to our `text-on-<role>` derivation; when the user authored no on-colors, the whole pairing arrives `derived` (with contrast diagnostics already run — a notable win over hand-built shadcn themes, which routinely ship failing contrast).
- `danger` → `--destructive`: `native` (name translation only). `neutral.subtle` → `--muted`, `accent` → `--accent`, `border/ring` → `--border`/`--input`/`--ring`: `native`.
- `radius.md` → `--radius` (shadcn derives sm/lg from it): `native`; if the user's radius scale isn't expressible via shadcn's single-var derivation, additional radius vars are emitted and classified `approximated`.
- `color-scheme` mode → `.dark` class block: `native`. Density: `dropped` (no concept).
- Sidebar/chart variable families (`--sidebar-*`, `--chart-1…5`): mapped when present; `--chart-*` uses the same categorical-palette derivation as the [ECharts exporter](echarts.md) — deliberate cross-exporter consistency (same rule, same palette).
- `unsupported`: shadcn's font/tracking vars beyond our typography catalog get framework defaults, reported.

## Ground-truth testing

Fixture Vite app with a representative shadcn component set; CI applies generated `globals.dsx.css`, builds with the era's Tailwind, headless-renders light and dark, and asserts computed styles for key component/variable pairs. Also validates emitted CSS parses under the era's toolchain.

## Notes

No `dsx doc` capability planned (shadcn's site documents the collection, not a themable build). Tier 1 preview covers the need with component samples. This exporter is also the primary showcase inside the [Storybook exporter](storybook.md)'s preview integration.
