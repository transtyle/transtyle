# Implementation plan — catalog v1 and the road to a reviewable Phase 1

**Audience: any implementer, including lower-capability AI models.** Every task below is self-contained: exact files, exact names, exact values, exact acceptance commands. Do not improvise where this document specifies; where it is silent, follow the referenced spec, and if still ambiguous, stop and ask rather than invent. Authority chain: [ADR-0010](../adr/0010-pre-release-breaking-changes.md) → [proposal 0001](../proposals/0001-universal-token-ir.md) (as amended by ADR-0010: clean break, no aliases) → this plan.

**Non-negotiable process for every task (from CONTRIBUTING):**
1. One task = one commit series ending in a push to `main`; commit message starts `feat:`/`fix:`/`docs:` and names the task id (e.g. `feat: V1-T2 …`).
2. Before committing: `npm run check:sync` passes; `npx transtyle build --cwd examples/acme && npx transtyle build --cwd examples/cathode` succeed; build twice and confirm `dist/` is byte-identical (determinism).
3. The **sync rule**: if the task changes user-visible behavior or vocabulary, update in the same series: `docs/` specs, `website/src/docs/*` (+ nav + roadmap page), `README.md`, examples (tokens/configs/READMEs/demo projects), and the [ROADMAP](../../ROADMAP.md) ledger. `scripts/check-sync.mjs` must be *extended* when a task creates a new drift class.
4. Worklog: add or extend a `docs/worklog/<date>-<task>.md` entry describing what was done and any deviation from this plan (deviations require a stated reason).

**Task states are tracked in the ROADMAP ledger** (checkboxes). Execute strictly in order unless the dependency notes say otherwise.

---

## V1-T1 — Rewrite the IR spec to catalog v1

**Depends:** nothing. **Files:** `docs/architecture/ir.md` (rewrite the catalog + status sections), `docs/architecture/derivation.md` (rule table, same commit), `website/src/docs/language.md` + `concepts.md` + `derivation.md` (user-facing mirror), `docs/exercises/` (add a one-line pointer at the top of each file: "Catalog v0 names herein are historical; see ADR-0010").

### The v1 catalog (normative — copy into ir.md verbatim as the new contract)

**Cell naming rule:** within a role, the *rest* state is the bare prominence name; other states suffix with `-<state>`; on-colors prefix `on-`. Grid paths are `semantic.color.<role>.<cell>`:

```
solid  solid-hover  solid-active  solid-selected      on-solid
tint   tint-hover   tint-active   tint-selected       on-tint
outline outline-hover
text   text-hover   text-active   text-strong
```

- Roles: `primary, secondary, accent, success, warning, danger, info, neutral` (unchanged), each carrying the full grid.
- The **authored anchor** of a role is `<role>.solid` (v0's `.base`). `derivation.require` continues to point at roles; requiring a role means its `solid` cell must be authored/aliased.
- **Elevation ladder:** `semantic.elevation.<n>.surface` for `n = 0..5`; `semantic.elevation.<n>.shadow` for `n = 1..4`. Semantic aliases are *removed* (ADR-0010): the old names `background, surface, surface-raised, overlay` become **the ladder itself** — all consumers say `elevation.0.surface` etc. `scrim` remains `semantic.color.scrim` (a veil, not a level — F2).
- **Content hierarchy:** `semantic.color.text.{strong, base, muted, subtle, disabled, inverse}` and `semantic.color.link.{base, hover, visited}`. (Note: `text.base` here means the *default rung* of the text ladder — `base` is the rung name, not the v0 state suffix. `text-muted` as a top-level slot is removed; it becomes `text.muted`.)
- `border`, `ring`: unchanged (`semantic.color.border.base` → now simply `semantic.color.border`; single-value slots lose the `.base` suffix: `border`, `ring`).
- `semantic.palette.categorical.1–8`: unchanged, including the 1–5 freeze (this contract predates release and is kept: charts matching across targets is a product promise).
- **Scales:**
  - `semantic.radius.{none,sm,md,lg,xl,full}` + family aliases `semantic.radius.{control,field,container}` (each defaults to `{radius.md}` as an alias token).
  - `semantic.space.{0,1,2,3,4,5,6,8,10,12,16,20,24}`.
  - `semantic.size.control.{sm,md,lg}`.
  - `semantic.border-width.{thin,medium,thick}`.
  - `semantic.breakpoint.{xs,sm,md,lg,xl,2xl}`.
  - `semantic.z.{hide,base,dropdown,sticky,banner,overlay,modal,popover,toast,tooltip}`.
  - Type primitives: `semantic.font.{sans,serif,mono,display}`, `semantic.type.size.{xs,sm,md,lg,xl,2xl,3xl,4xl}`, `semantic.type.weight.{regular,medium,semibold,bold}`, `semantic.type.leading.{tight,normal,loose}`, `semantic.type.tracking.{tight,normal,wide}`.
  - Type roles (DTCG `typography` composites): `semantic.type.role.{display,heading,title,body,label,code}.{sm,md,lg}`.
  - Motion: `semantic.duration.{instant,fast,normal,slow,slower}`, `semantic.easing.{standard,enter,exit,emphasized,spring}` (document: `enter`≡decelerate, `exit`≡accelerate; v0's `bounce` renames to `spring`).
- **Reserved mode dimensions** (names only; all optional): `color-scheme`, `density(compact|comfortable|spacious)`, `contrast(standard|more)`, `motion(full|reduced)`, `platform(desktop|touch)`.
- **Archetype extension** (spec now, engine in V1-T7): `$extensions.transtyle.role: { "archetype": "brand"|"status"|"neutral" }` on a custom `semantic.color.<name>` group.

### Steps

1. Rewrite ir.md sections "The semantic contract" and the status banner (banner → "IR spec v1 (draft, pre-release); see ADR-0010; freeze re-arms at first publication"). Keep tiers/modes/values/provenance/stability sections, editing the stability text per ADR-0010.
2. Rewrite the derivation.md rule table to the V1-T2 table below (spec and engine must land in the same window; T1+T2 may be one commit series).
3. Mirror on the website (language.md gets the grid table and the new false-friends appendix from proposal §2.2).
4. Add the historical-note line to each `docs/exercises/phase0-*.md`.

**Acceptance:** `grep -rn "\.base\b" docs/architecture/ir.md` returns only the `text.base` ladder rung and prose about v0 history; website builds; `npm run check:sync` passes (extend the checker per V1-T3 first if executing together).

---

## V1-T2 — Engine: the v1 rule pack (grid + ladders + scales)

**Depends:** T1. **Files:** `packages/core/src/derive.js` (main), `packages/core/src/checks.js` (contrast checks follow new slot names), `packages/ir/src/index.js` (COLOR_ROLES unchanged; add `GRID_CELLS`, `TEXT_RUNGS`, `Z_LADDER` constants).

**Exact rules (deterministic; all colors OKLCH; `mix` = cartesian OKLab per F21; `surface(n)` = `elevation.<n>.surface` of the current mode; deltas flip sign in dark mode exactly as today):**

| Cell / slot | Rule (fill only if unauthored) |
|---|---|
| `<role>.solid` | role anchors as today (primary must be authored; secondary = desaturate; success/warning/danger/info = hue anchors 150/85/25/230; accent = alias primary; neutral = near-gray at primary hue) |
| `solid-hover` | `L ± 0.05` from `solid` (existing) |
| `solid-active` | `L ± 0.07`, `C × 0.9` (existing) |
| `solid-selected` | alias of `solid-active` |
| `tint` | `mix(solid, surface(1), 0.92)` (existing subtle) |
| `tint-hover` | `mix(solid, surface(1), 0.88)` |
| `tint-active` | `mix(solid, surface(1), 0.84)` |
| `tint-selected` | alias of `tint-active` |
| `outline` | `mix(solid, surface(1), 0.70)` (F10, promoted) |
| `outline-hover` | `mix(solid, surface(1), 0.55)` |
| `on-solid` | contrast-pick white/near-black vs `solid`, AA-warned (existing) |
| `on-tint` | on-brand walk vs `tint` (existing F19 rule) |
| `text` | on-brand walk of `solid` against `surface(0)` (same algorithm, background as the pair) |
| `text-hover` | `L ± 0.05` from `text` |
| `text-active` | `L ± 0.07` from `text` |
| `text-strong` | `{ l: text-ladder base L, c: solid.c, h: solid.h }` (v0 contrast-anchor, F20) |
| `elevation.0.surface` | authored (was `background`) — required-with-fallback: if unauthored, white in light / `oklch(0.145 0 0)` in dark, provenance `defaulted` |
| `elevation.1.surface` | authored (was `surface`); fallback = `elevation.0.surface` |
| `elevation.n.surface` (n=2..5) | `raise(elevation.(n-1).surface)` — existing raise() applied iteratively |
| `elevation.n.shadow` (n=1..4) | geometry/alpha table (light / dark alphas): 1: `0 1px 2px` .06/.3 · 2: `0 4px 12px` .10/.4 · 3: `0 12px 32px` .16/.5 · 4: `0 24px 48px` .20/.55; color = `scrim` hex |
| `scrim` | unchanged (`oklch(0.1 0 0 / 0.5)`) |
| `text.base` | authored (was `text.base` slot `text`); `text.strong` = `contrast-anchor` on neutral (i.e. old `neutral.contrast` value); `text.muted` authored-or `mix(text.base, surface(1), 0.35)`; `text.subtle` = `mix(text.base, surface(1), 0.55)`; `text.disabled` = `text.base` with `alpha 0.38`; `text.inverse` = `text.base` **of the other color-scheme mode** (cross-mode read — implement as a post-pass after both modes resolve) |
| `link.base` | alias of `primary.text` · `link.hover` = `primary.text-hover` · `link.visited` = `mix(link.base, {l of solid, c×0.7, h+40}, 0.5)`? **No — keep deterministic-simple:** `link.visited` = `link.base` with `h + 40`, same l/c |
| `ring` | unchanged (primary, dark-lightened, F3) · `border` | authored (rename only) |
| `radius.*` | existing F8 ramp; family aliases default `{semantic.radius.md}` |
| `space.k` | `k × 0.25rem` for every catalog key, `defaulted` (authored wins) |
| `size.control.{sm,md,lg}` | `2rem / 2.25rem / 2.5rem`, `defaulted` |
| `border-width.{thin,medium,thick}` | `1px / 2px / 4px`, `defaulted` |
| `breakpoint.{xs,sm,md,lg,xl,2xl}` | `480px / 640px / 768px / 1024px / 1280px / 1536px`, `defaulted` |
| `z.*` | `hide:-1, base:0, dropdown:1000, sticky:1020, banner:1030, overlay:1040, modal:1050, popover:1060, toast:1080, tooltip:1090`, `defaulted` |
| `type.size.*` | modular base `1rem` ratio `1.25`: xs `0.64rem`, sm `0.8rem`, md `1rem`, lg `1.25rem`, xl `1.563rem`, 2xl `1.953rem`, 3xl `2.441rem`, 4xl `3.052rem` (3-decimal rounding), `defaulted`; authored `type.base`/`type.ratio` seeds override the ramp inputs |
| `type.weight.*` | `400/500/600/700` · `type.leading.*` `1.25/1.5/1.75` · `type.tracking.*` `-0.01em/0/0.02em`, all `defaulted` |
| `type.role.<r>.<s>` | typography composites from primitives: family = `display` role→`font.display` else `heading/title`→`font.sans`, `code`→`font.mono`, others `font.sans`; size mapping table: display `{sm:3xl, md:4xl, lg:4xl}`… **full 18-cell table**: display(sm 2xl, md 3xl, lg 4xl) · heading(sm lg, md xl, lg 2xl) · title(sm md, md lg, lg xl) · body(sm sm, md md, lg lg) · label(sm xs, md sm, lg md) · code(sm xs, md sm, lg md); weight: display/heading/title `bold/semibold/semibold`, body `regular`, label `medium`, code `regular`; leading: display/heading `tight`, others `normal` |
| `duration.*` | `0ms / 150ms / 250ms / 400ms / 600ms`, `defaulted` |
| `easing.*` | standard `cubic-bezier(0.2, 0, 0, 1)` · enter `cubic-bezier(0, 0, 0, 1)` · exit `cubic-bezier(0.3, 0, 1, 1)` · emphasized `cubic-bezier(0.2, 0, 0, 1)` (placeholder = standard until a two-segment form is spec'd) · spring `cubic-bezier(0.34, 1.56, 0.64, 1)`, `defaulted` |

**Implementation notes:** keep `fill()`/`fillDim()`; add `fillAlias()` (provenance `derived`, rule `alias(<cell>)`); the cross-mode `text.inverse` pass runs after the per-mode loop; lazy evaluation is *not* required — eager fill of the whole catalog is acceptable at this scale (~150 slots/mode) and simpler.

**Acceptance:** a new `scripts/check-grid.mjs` (write it in this task): compiles Acme, asserts (a) every catalog slot above exists in both modes with a value, (b) 12 exact spot values (list them in the script from a hand-verified run and freeze), (c) `tint` equals v0's `subtle` value `#e7effa` for primary, `outline` equals `#b7d2f4` (the F10 fixture value), `on-tint` equals `#005bb6` — proving the promoted conventions reproduce the shipped Bootstrap fixture byte-for-byte.

---

## V1-T3 — Migrate exporters, examples, fixtures, demos to v1 names

**Depends:** T2. **Files:** all six `packages/exporter-*/src/index.js`, `examples/*/tokens/*.json`, `examples/*/transtyle.config.json` (`derivation.require` unchanged — roles), `examples/acme/expected/*` (headers + any slot-name comments; **values must not change**), demo projects only if they reference slot names (they don't — they consume dist), `scripts/check-sync.mjs`.

**Exact renames to apply (old → new), everywhere:**

`<role>.base→<role>.solid` · `<role>.hover→<role>.solid-hover` · `<role>.active→<role>.solid-active` · `<role>.subtle→<role>.tint` · `<role>.contrast→<role>.text-strong` · `text-on-<role>.base→<role>.on-solid` · `text-on-<role>.subtle→<role>.on-tint` · `background.base→elevation.0.surface` · `surface.base→elevation.1.surface` · `surface-raised.base→elevation.2.surface` · `overlay.base→elevation.3.surface` · `scrim.base→scrim` · `text.base→text.base` (path becomes `semantic.color.text.base` under the ladder group — **unchanged string, new meaning documented**) · `text-muted.base→text.muted` · `border.base→border` · `ring.base→ring`.

Exporter-specific: Bootstrap's private border mix is **deleted** and replaced by reading `<role>.outline` / `outline-hover`; its `$light`/`$dark` pseudo-roles read `neutral.tint` / `neutral.text-strong`; Storybook's `textInverseColor` reads `text.inverse` (delete the cross-mode read from the exporter — the engine owns it now).

Add to `scripts/check-sync.mjs`: a **dead-vocabulary guard** — fail if any of these regexes match in `packages/`, `examples/*/tokens`, `examples/*/transtyle.config.json`, or `website/src/docs`: `text-on-`, `\.subtle\b` (color context), `surface-raised`, `semantic\.color\.[a-z-]+\.base\b` except `text.base`. Keep the list in an array with comments.

**Acceptance:** `npx transtyle build` on both examples; **color values in `dist/` byte-identical to the pre-migration build** for shadcn/daisyui/echarts/bootstrap/storybook (save a pre-migration `dist/` copy and `diff -r`, ignoring the provenance comments if slot names appear in them — normalize comments before diff or update fixture comments in the same commit); `scripts/check-fixtures.mjs` (from V1-T5, or the scratch acceptance scripts until then) passes; all ten demo projects `npm run build` green.

---

## V1-T4 — css-variables exporter (the conformance dump, now grid-complete)

**Depends:** T3. **Files:** new `packages/exporter-css-variables/{package.json,src/index.js}`, CLI registry + deps, both example configs (`"css-variables": { "output": "dist/css-variables" }`), new demo projects `examples/*/demo/css-variables/` (vanilla Vite, ports 4105/4205), spec `docs/specs/exporters/css-variables.md`, website page + nav + roadmap table, README mention, `check-sync` NAMES entry (and fix its registry regex to accept quoted keys: `/^\s*['"]?([\w-]+)['"]?:/gm`).

Behavior: emit `variables.transtyle.css` + `usage.md`. Every `semantic.*` slot with a value → one custom property; name = path minus `semantic.`, dots→dashes (`--color-primary-solid`, `--color-primary-on-solid`, `--elevation-1-surface`, `--type-size-md`, `--z-modal`); type-role composites emit longhand sub-properties (`--type-role-body-md-size/-weight/-leading/-family`). `:root` = light map, `[data-color-scheme="dark"]` = dark (option `darkSelector`; option `prefix`). Sorted alphabetically. Coverage: every var `native` with provenance. Demo page: reads the stylesheet with `?raw`, renders a swatch/value grid grouped by family + a sample card/button built from raw vars + mode toggle setting `data-color-scheme`.

**Acceptance:** build both examples; the file contains ≥ 120 variables for Acme; `check:sync` passes; demo `npm run build` green.

---

## V1-T5 — Permanent ground-truth scripts + CI

**Depends:** T3 (fixtures stable in v1 form). **Files:** `scripts/check-fixtures.mjs`, `scripts/check-determinism.mjs`, `.github/workflows/ci.yml`, CONTRIBUTING pointer, website roadmap row.

- `check-fixtures.mjs`: port the session's acceptance parsers — key/value diff of `examples/acme/expected/bootstrap/{_variables,_maps,bootstrap-theme.css}` and `expected/storybook/theme.transtyle.ts` (+ preview/manager probes) against a fresh `dist/` build; value-normalized (leading-zero, whitespace, comments); exit 1 on any mismatch, printing per-key diffs.
- `check-determinism.mjs`: build each example twice into temp dirs, `diff -r`; exit 1 on any byte difference.
- CI (`ci.yml`): on push/PR to main — Node 20, `npm ci`, `npm run check:sync`, `node scripts/check-grid.mjs`, `node scripts/check-fixtures.mjs`, `node scripts/check-determinism.mjs`, `npm run site:build`, then matrix-build the demo projects (`npm run build -w <each>`; Storybook builds may be `continue-on-error: false` but cached).
- Root scripts: `"check:fixtures"`, `"check:determinism"`, and `"check:all"` chaining sync+grid+fixtures+determinism.

**Acceptance:** `npm run check:all` green locally; the workflow file lints (`npx yaml-lint` or GitHub's parser on push).

---

## V1-T6 — CLI: `explain`, `init`, `add`

**Depends:** T2. **Files:** `packages/cli/src/main.js` (+ optionally split `src/commands/*.js`), `docs/specs/cli.md` (mark implemented), website `cli.md`, README.

- `transtyle explain <slot> [--mode <m>]`: runs the pipeline (`emit:false`), prints for the slot (and each input, recursively, indented): value (formatted per type), provenance kind, rule id, inputs. Slot accepts with or without `semantic.` prefix. Unknown slot → exit 2 listing 5 closest names (Levenshtein). Example output block goes in the spec — copy it exactly.
- `transtyle init [name]`: refuses if `transtyle.config.json` exists (exit 2). Writes: config (name = arg or directory name; modes light/dark; targets `css-variables`; `derivation.require: ["semantic.color.primary"]`) + `tokens/tokens.json` with option tier (one `brand.500` placeholder `oklch(0.55 0.18 255)`) and semantic tier authoring `primary.solid`, `elevation.0.surface`, `elevation.1.surface`, `text.base`, `text.muted`, `border`, `radius.md`, `font.sans`, `font.mono` — each aliasing or literal with a `// TODO` comment equivalent (JSON: `$description`). Prints next steps.
- `transtyle add <target>`: validates against OFFICIAL_EXPORTERS (exit 2 otherwise, listing valid names), inserts `"<target>": { "output": "dist/<target>" }` into config preserving JSON formatting (read-modify-write with 2-space indent), prints the build command.

**Acceptance:** golden-file test script `scripts/check-cli.mjs`: runs `init` in a temp dir, `add shadcn`, `build`, `explain color.primary.tint` and asserts exit codes + key output substrings.

---

## V1-T7 — Role archetypes

**Depends:** T2, T3. **Files:** `packages/ir` (read `$extensions.transtyle.role`), `packages/core/src/derive.js` (extend role list per compile from archetyped customs), `docs/architecture/ir.md` §archetypes (written in T1, mark implemented), exporters daisyui + css-variables (open-role emission), `examples/cathode` (author `crt-amber` as archetype `status`, bind nothing else — the showcase), website language.md.

Behavior: any `semantic.color.<name>` group carrying the extension joins `COLOR_ROLES` for grid derivation in that compile. Exporters with open role sets emit it (`css-variables` automatically; `daisyui` as a daisyUI custom color `--color-<name>` + `-content`); closed-set exporters add one coverage line `dropped (closed role set)`.

**Acceptance:** Cathode build shows the full `crt-amber` grid in `dist/css-variables/` and a `--color-crt-amber` pair in daisyUI output; `check-grid.mjs` gains an archetype assertion.

---

## V1-T8 — Multi-dimension modes + reserved dimensions

**Depends:** T2. **Files:** `packages/core/src/normalize.js` (remove the single-dimension throw; resolve per-dimension independently; expanded matrix keyed `mode1+mode2` only where a token varies on both), `derive.js` (mode loop iterates the expanded matrix), exporters receive the matrix (existing API; they declare expressible dimensions — non-expressible → coverage `dropped(mode:<dim>)`), spec ir.md modes section (T1 text stands), one worked example: add `density` (`comfortable|compact`) to Acme varying `space.*` ×0.875 in compact via a mode-scoped layer file.

**Acceptance:** Acme builds with the density dimension; shadcn output unchanged (declares only `color-scheme`; coverage reports density dropped); css-variables emits `[data-density="compact"]` block (add `dimensionSelectors` option).

---

## V1-T9 — Radix Themes exporter (the grid's acceptance test)

**Depends:** T3 (grid live), T7 recommended. **Files:** new `packages/exporter-radix/`, CLI registry, configs, spec `docs/specs/exporters/radix.md`, website page/nav/roadmap, README, demo projects `demo/radix/` (ports 4106/4206; use `@radix-ui/themes` npm with `--<color>-1..12` custom palette CSS), `check-sync` NAMES.

Mapping (per role; both modes): step 1 ← `elevation.0.surface` · 2 ← `mix(solid, surface(0), 0.96)` `approximated` · 3/4/5 ← `tint`/`tint-hover`/`tint-active` · 6 ← `mix(solid, surface(1), 0.78)` `approximated` · 7/8 ← `outline`/`outline-hover` · 9/10 ← `solid`/`solid-hover` · 11/12 ← `text`/`text-strong`. Also emit the gray scale from `neutral`, and alpha variants (`--<color>-a1..a12`) as the same colors with computed alpha over white/black — mark `approximated`. Output: `radix-colors.transtyle.css` (custom palette per Radix docs) + `usage.md`.

**Exit gate (from proposal §7):** this exporter shipping with zero catalog amendments = one clean attempt for the v1 catalog; two consecutive clean exporter additions re-freeze the catalog per ADR-0010.

---

## V1-T10 — DTCG validation UX

**Depends:** none (parallel-safe after T3). **Files:** `packages/core/src/load.js` + `diagnostics.js`, `docs/specs/validation-and-coverage.md`, website diagnostics page.

New diagnostics (stable codes): `TST1301` unknown `$type` (warn, token carried opaque) · `TST1302` `$value` missing (error) · `TST1303` alias to non-existent path — already `TST1105`; keep · `TST1304` foreign `$extensions` namespaces (info, listed once per namespace) · `TST1305` token outside the three tiers (warn: "top-level group `<x>` is not option/semantic/component"). Each with a one-line remediation hint. Add a `--json` flag to `check` printing the diagnostics array (spec'd in cli.md already).

**Acceptance:** fixture files under `packages/core/test-fixtures/` (new) exercising each code; `scripts/check-cli.mjs` extended.

---

## V1-T11 — The real-DS run (Phase 1 exit)

**Depends:** T3–T9. Adopt one open, real design system (candidate: **GOV.UK Design System** tokens, or IBM's Carbon white theme as source) via the binding-layer pattern (`docs/website adopt-existing.md` playbook): its tokens stay pure DTCG, one bindings file maps catalog slots. Deliver: `examples/<real-ds>/` with tokens+config+README+demo projects, a review checklist per target filled by a human practitioner (the maintainer), findings ledger (any catalog amendment = counter reset per ADR-0010 re-freeze rules).

**Acceptance:** all seven targets build; maintainer signs the review checklist; ROADMAP Phase 1 exit flipped.

---

## Deferred (explicitly not in v1)

M3/Fluent/Carbon/Chakra exporters (Phase 3 order per backlog B3) · importers (Phase 3) · component tier (v2, ADR-0003) · state-layer mechanism (`transtyle.state-mechanism`) until an exporter needs it (M3) · `emphasized` two-segment easing · vendor round-trip extensions (Phase 3 importers).
