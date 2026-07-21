# 2026-07-20 — T7: role archetypes (the open-role-set path)

Per [docs/plan/catalog-revision.md](../plan/catalog-revision.md) T7. Picked up right after T9, since it was the only remaining task in the T1–T9 chain and its dependencies (T2, T3) were already done.

## What shipped

- **`packages/ir/src/index.js`** — `ROLE_ARCHETYPES = ['brand', 'status', 'neutral']` and `collectRoleArchetypes(tree, diagnostics)`, which walks a merged (pre-flattened) tree's `semantic.color.*` groups for `$extensions.transtyle.role.archetype`, excluding the eight built-in roles. Warns `TST1111` on an unrecognized archetype value (the role still joins the grid — the archetype tag is informational for exporters, not a derivation switch).
- **`packages/core/src/normalize.js`** — calls `collectRoleArchetypes(merged, diagnostics)` and returns it as `roleArchetypes` (a `Map<name, archetype>`) alongside `modes`/`defaultMode`/etc., so every exporter (which receives the same `normalized` object `derive()` mutated) can see it too.
- **`packages/core/src/derive.js`** — the role-grid loop now iterates `[...COLOR_ROLES, ...normalized.roleArchetypes.keys()]` instead of just `COLOR_ROLES`. No new derivation logic was needed: `resolveRoleSolid()`'s existing fallback branch (`return get(ctx.map, rp + 'solid')`) already requires an authored `.solid` for any role name it doesn't recognize — exactly the desired behavior (a custom role authors its own anchor color, the way `primary` does, rather than being derived from it). Added `TST1203`: warn if a role carrying an archetype extension has no authored `.solid` in a given mode, so a mistake fails loud instead of silently producing an empty grid.
- **`packages/exporter-daisyui/src/index.js`** — daisyUI has an open color set (any `--color-<name>` custom property is a real Tailwind utility color), so the theme-block builder now also loops `normalized.roleArchetypes`, emitting `--color-<name>` / `--color-<name>-content` from `<name>.solid` / `<name>.on-solid`, coverage `native`.
- **`packages/exporter-css-variables/src/index.js`** — **zero changes needed.** It already walks every `semantic.*` slot generically; once `derive.js` populates `semantic.color.crt-amber.*`, the exporter dumps it automatically. This is exactly the "automatically" the plan called for.
- **`examples/cathode/tokens/transtyle.bindings.tokens.json`** — added the showcase role:
  ```json
  "crt-amber": {
    "solid": { "$value": "{semantic.color.crt.amber}" },
    "$extensions": { "transtyle.role": { "archetype": "status" } }
  }
  ```
  Aliases the same `crt.amber` option-tier color already bound to `warning.solid` — deliberately "binding nothing else" (plan's wording) so this is purely a demonstration of the archetype mechanism, not a rewire of Cathode's actual warning role.
- **`scripts/check-grid.mjs`** — added an archetype assertion: compiles Cathode too, asserts `crt-amber` is recognized as an archetype role and that 11 of its grid cells resolve in both modes.
- Docs: `docs/architecture/ir.md` (§archetypes marked implemented, status banner updated — T4/T6/T7/T9 all now done, "seven exporters" not six), `docs/specs/exporters/{daisyui,css-variables}.md` (new sections), website mirrors of both, `website/src/docs/language.md` (flipped the archetype line from `specced` to `compiled`), `website/src/docs/roadmap.md` (moved the row from Specced to Implemented; also corrected a stale line claiming the Radix `text-strong` gamut gap was "tracked, not yet fixed" — it was fixed earlier today), `ROADMAP.md` (T7 checked off).

## Why this was cheap

The catalog-revision engine work (T2/T3) already made every role-grid rule generic over a role name (`resolveRoleSolid`, the tint/outline/text mix chain, on-brand walks) — none of it hardcodes `COLOR_ROLES` by name inside the derivation math itself, only in the one line that decides which roles to loop over. Opening that up to include archetyped custom roles was a one-line change in `derive.js` plus the extension-parsing plumbing (ir → normalize). The generic css-variables exporter needed nothing at all — proof that "grid-complete conformance dump" from T4 does what it says.

## Scope decision: closed-set exporters don't emit a `dropped` line

The plan's prose says closed-set exporters (Bootstrap, shadcn, ECharts, Storybook, Radix) should "add one coverage line `dropped (closed role set)`" when they skip an archetyped role. The **acceptance criteria** for T7 only requires the css-variables and daisyUI behavior above. Adding an explicit dropped-coverage line to five more exporters that don't otherwise reference `normalized.roleArchetypes` at all is real scope beyond what's tested — left out of this change; flagged here rather than silently doing a partial job. A future pass through those five exporters (if a real user wants that visibility) is a small, independent addition, not a blocker on anything.

## Verification performed before committing

- Direct engine test (bypassing exporters): compiled Cathode, confirmed `normalized.roleArchetypes` contains `crt-amber → status`, no `TST11xx` diagnostics, and all core grid cells (`solid`, `tint`, `outline`, `on-solid`, `on-tint`, `text`, `text-strong`, etc.) resolve with real OKLCH values in both modes.
- `npx transtyle build --cwd examples/cathode` — all seven targets build clean; confirmed `--color-crt-amber*` present in both `dist/css-variables/` (14 cells × 2 modes) and `dist/daisyui/` (solid + content, both theme blocks).
- `npm run check:all` — clean, including the new check-grid archetype assertion.
- `npm run site:build` — clean.
- Cathode's daisyUI demo re-verified in-browser: built-in roles unaffected, no console errors (the new custom color isn't consumed by the demo's Tailwind classes, since that would require its own utility-class wiring — out of scope here; the CSS variable itself is proven to exist and resolve correctly via the build output).
