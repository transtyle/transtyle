# 2026-07-21 — C6: official launch (CLI registry, five-surface docs, first Angular demo)

Per [docs/plan/component-tier.md](../plan/component-tier.md) C6, the last task in the component-tier plan. Depends on C3/C4/C5 (all done). This is the one commit where `check-sync.mjs`'s all-five-surfaces-at-once rule applies — `primeng` is now a fully supported, documented exporter, not just real-but-unregistered code.

## What shipped

- **CLI registry**: `primeng` added to `packages/cli/src/main.js`'s `OFFICIAL_EXPORTERS` + `packages/cli/package.json`'s dependency list.
- **Five-surface docs**: `docs/specs/exporters/primeng.md` (new); `website/src/docs/exporter-primeng.md` (new) + `nav.js` + `roadmap.md`; `README.md`; `scripts/check-sync.mjs`'s `NAMES` entry. `npm run check:sync` confirms all five surfaces agree across all four examples.
- **Example configs**: `transtyle.config.json` in all four examples (`acme`/`cathode`/`govuk`/`carbon`) gets a `"primeng": { "output": "dist/primeng" }` target.
- **`demo/primeng/`** for all four examples — real, standalone Angular 22 applications (`@angular/build:application`, the modern esbuild/zoneless builder), the first non-Vite/React demo profile in the repo. `docs/specs/demo-app.md` extended with a full "Angular profile" section, plus two pieces of pre-existing staleness fixed in passing: the project table was missing `radix`/`css-variables` rows (shipped since, never added to the table), and the port-range note only covered the original two examples — both corrected while touching the file for the actually-scoped reason.
- **`.claude/launch.json`** and **`.github/workflows/ci.yml`**'s demo build matrix: one `<example>-primeng` entry each (28 → 32 demo-matrix entries). Also added `npm run check:component-tier` to the CI `checks` job — a real pre-existing gap from C2 (it was added to `check:all` locally but never to CI's own step list, since CI calls each `check:*` script individually rather than `check:all`).
- **`.gitignore`**: added `.angular/` (Angular's build cache directory) — the first Angular tooling in the repo.

## The Angular toolchain caught real bugs no prior demo could

This is the most valuable finding from C6, not a footnote. Every prior demo uses Vite, which does **not** type-check on build — Angular's compiler does, full stop, as part of `ng build`. Compiling the emitted `preset.transtyle.ts` against PrimeNG's own `DesignTokens` TypeScript types surfaced genuine structural bugs in the C3-C5 exporter code that had shipped with only a lightweight brace-balance check:

1. **Every color-ish group needs `colorScheme: { light, dark }`, not a flat object.** PrimeNG's types reject an unwrapped `colorScheme` — confirmed by fetching `aura/base/index.ts` directly: every group (`formField`, `overlay.*`, `list.option`, `navigation.item`, `content`, `text`, `highlight`, `mask`) splits into a **mode-invariant top-level object** (padding/gap/radius/shadow-shape) and a **separate** `colorScheme.{light,dark}.<group>` object for color. This required rewriting `archetypes.js` (each helper now returns `{ structural, colorScheme }`) and `descriptors.js`/`index.js` (every builder now computes both a light and a dark map and assembles the split) — previously the exporter only ever built one mode's values.
2. **`primary.{50..950}` is mode-invariant; `surface.{0,50..950}` is mode-scoped** — confirmed by finding the dark section defines its own, independently-named ramp (zinc family vs. light's slate family). Fixed: primary ramp derived once (light map, documented simplification); surface ramp computed per mode.
3. **Popover/Dialog's shared `padding` doesn't belong on `root`** — it's `content.padding`, a sibling field, not part of the same object as `background`/`borderColor`/`color`/`borderRadius`/`shadow`.
4. **Menu's own component-level `item` type is narrower than the shared `semantic.navigation.item` group** — no `active*` fields at the component level (Menu has no active state), even though the shared group does.
5. **Message uses `error`, not `danger`** — same real PrimeNG naming inconsistency already found for InlineMessage in C4, but the fix hadn't been applied to Message's own builder.
6. **Object keys with hyphens need quoting.** Cathode's `crt-amber` role archetype (T7) broke the TS serializer's naive `key()` helper, which only quoted digit-leading keys — fixed to quote anything that isn't a valid bare JS identifier.
7. **`fontWeight` must serialize as a string**, matching real PrimeNG (`'600'`, not `600`) — our own derivation stores it as a `number` type.
8. **ProgressBar/Rating have no `colorScheme` block in real PrimeNG at all.** Their own Aura default writes a bare token-reference string (`'{primary.color}'`) rather than resolving a color — reusing that exact convention was the correct fix, not adding a colorScheme wrapper that doesn't exist in their type. A resolved literal would also have been mode-wrong (no per-mode slot to put a second value in).

None of these would have been caught by the C3 acceptance script's lightweight brace-balance/regex checks. This is a real, unplanned benefit of PrimeNG being Angular-only: the demo project itself became a much stronger verification tool than any prior exporter's demo.

## Verification performed before committing

- `npx transtyle build primeng --cwd examples/<example>` — clean for all four, 87% native · 3% derived · 3% approximated · 0% dropped · 7% unsupported.
- `npx ng build --configuration development` **and** `npm run build` (production, default config) — clean for all four Angular workspaces, zero TypeScript errors, full type-check against PrimeNG's real `DesignTokens` types.
- In-browser verification: Acme (light + dark toggle, all six Nimbus Console sections rendered, brand-blue-coherent buttons/tags/card/form/table) and Cathode (dark-default CRT-green theme, `crt-amber` extend path exercised, no console errors) — both via the real dev server (`ng serve`), not just a static build.
- `npm run check:sync` — clean, 8 exporters × 4 examples × 5 surfaces.
- `npm run check:all` — clean, including `check:component-tier` (C2's regression guard, confirming this task touched nothing in the shared catalog/derivation path).
- `npm run site:build` — clean, new `exporter-primeng` doc page builds.

## Deviations from the plan

- Fixed two small pieces of *pre-existing* documentation staleness while already editing the touched files (missing radix/css-variables rows in `demo-app.md`'s project table; CI missing `check:component-tier`) — both directly adjacent to this task's actual scope, not unrelated drive-by changes.
- Bumped the Angular workspaces' production bundle-size budget (1MB → 1.5MB warning threshold) — PrimeNG + Angular's baseline bundle is larger than the other demos' Vite bundles; this is a real, expected difference in toolchain weight, not a regression to chase.

## Not done in this pass

Extending severity-mapper/archetype coverage beyond the components C4/C5 already proved (optional follow-up, not required by the plan); the conditional C7 promotion (already skipped per C1's verdict — see that worklog).
