# Implementation plan — Bootstrap component-tier theming (AL1)

**Audience: any implementer, including lower-capability AI models.** Every task is self-contained: exact files, exact acceptance commands. Do not improvise where this document specifies; where it is silent, follow the referenced spec, and if still ambiguous, stop and ask rather than invent. Authority chain: [ROADMAP — First alpha definition](../../ROADMAP.md) (AL1's mandate) → [component-layer.md](../specs/component-layer.md) (the theming-not-behavior boundary) → [component-tier.md](component-tier.md) + the shipped `@transtyle/exporter-primeng` (the pattern precedent: descriptors over logic) → this plan.

**Why this is the alpha's centerpiece:** Bootstrap is the second component-heavy implementation — the trigger the component-tier plan reserved for generalizing the shared `component.*` catalog. Everything learned here that PrimeNG independently confirms becomes AL2's promotion input; everything else stays exporter-private forever. AL1 itself promotes **nothing** into the shared catalog.

**Non-negotiable process for every task (from CONTRIBUTING, identical to the C-series):**

1. One task = one commit series ending in a push to `main`; commit message names the task id (e.g. `feat: AL1.3 …`).
2. Before committing: `npm run check:sync` passes; `npm run check:all` passes; determinism holds (`check:determinism` covers the exporter's new files automatically once they're emitted).
3. Bootstrap is already registered on all five surfaces, so no new-surface obligations arise — but the exporter's docs pages ([docs/specs/exporters/bootstrap.md](../specs/exporters/bootstrap.md), the website exporter page) must be updated **in the same series** as the behavior they describe (AL1.6 batches the final pass; interim tasks update only what they change).
4. Worklog: `docs/worklog/<date>-al1x.md` per task; deviations from this plan require a stated reason.
5. **The meta-language principle applies throughout:** a Bootstrap binding may read any slot already in `COMPONENT_CATALOG` (today: `button.radius`/`padding-x`/`padding-y`); where Bootstrap needs a component meaning the catalog lacks, the exporter derives it **privately** from `semantic.*` and records it as an AL2 promotion candidate. `packages/ir` does not change in this plan.

## Ground truth (verified 2026-07-23 against `bootstrap@5.3.8`, hoisted at the repo root via the demo workspaces)

- `scss/_variables.scss` declares **952 top-level `$` variables**, of which roughly **670 are component-scoped** across ~35 families. The biggest: forms 135 + input 61 (one merged family in practice), `$btn-*` 49, `$dropdown-*` 38, `$modal-*` 31, `$navbar-*` 31, `$pagination-*` 29, `$accordion-*` 26, `$carousel-*` 26, `$table-*` 27. The long tail runs down to `$dt-font-weight` (1).
- Bootstrap 5.3 additionally exposes a **runtime CSS-variable layer per component** (`--bs-btn-*`: 65 occurrences in `_buttons.scss` alone), set inside component rules — overridable post-compile via selector-scoped declarations, and enumerable from the same Sass sources.
- The current exporter ([packages/exporter-bootstrap/src/index.js:169](../../packages/exporter-bootstrap/src/index.js)) covers this entire surface with one honest blanket line: `cov('$btn-*/component tier', '—', 'unsupported', 'component-tier variables reserved for the v2 component layer (ADR-0003)')`. **AL1's definition of done is that this line no longer exists** — replaced by per-family classifications with nothing silent.
- The engine side needs nothing new: C2's resolve-or-fill already resolves `component.*` with authored-wins + semantic defaults ([packages/core/src/derive.js:218](../../packages/core/src/derive.js)), and the PrimeNG exporter established the descriptor pattern (per-component data, zero per-component logic — [packages/exporter-primeng/src/descriptors.js](../../packages/exporter-primeng/src/descriptors.js)).

## Design decisions made here (do not relitigate during implementation)

1. **Both emission paths, one binding table.** The Sass path is authoritative (set `$btn-*` before Bootstrap's import — reaches everything); the CSS-variable path emits selector-scoped `--bs-<component>-*` overrides and honestly documents what it cannot reach (values Sass baked into compiled rules, extending the existing honesty note in `renderCss`/usage.md). One descriptor drives both; the inventory records which variables have CSS-var counterparts.
2. **The inventory defines the denominator.** "ALL tokens" is measured against a checked-in, machine-readable inventory of the component-theming surface — not against every `$` variable. Explicitly out of inventory, with the reason recorded _in the inventory file itself_: `$enable-*` feature flags (build switches, not theme values), the `$theme-colors`/palette maps (already driven by the semantic tier today), the utility/scale definitions (`$spacers`, `$grid-*`, `$container-*` — foundations, already covered), and CSS-selector/structural options. Everything in the inventory gets a classification; nothing silent is the AL3 bar.
3. **Classification vocabulary is the existing five export coverage classes** ([validation-and-coverage.md](../specs/validation-and-coverage.md)) — no new report vocabulary in this plan. `dropped`/`unsupported` entries are allowed where honest (e.g. `$carousel-indicator-transition` if motion mapping can't express it) but must carry a note; the AL3 bar is **zero _unclassified_** slots, and every `unsupported` entry is by construction AL2/catalog-growth data.
4. **Emitted files don't multiply.** Component variables go into the existing `_variables.transtyle.scss` (a clearly-marked component section) and the existing CSS-variable file — same import story users already have; `usage.md` gains a component-theming section.

## Tasks

### AL1.1 — Surface inventory (mechanical extraction, checked in, guarded)

**Depends:** nothing. **Files:** `packages/exporter-bootstrap/tools/extract-surface.mjs` (parses `node_modules/bootstrap/scss/_variables.scss` + the per-component partials' `--#{$prefix}<comp>-*` declarations); `packages/exporter-bootstrap/surface-inventory.json` (checked in: per variable — name, family, value-type guess, CSS-var counterpart or null, in/out of inventory + reason); `scripts/check-bootstrap-surface.mjs` wired into `check:all` (re-runs the extractor against the installed Bootstrap and diffs — the same regenerate-and-diff guard `check:fixtures` uses; fails if the pinned Bootstrap version drifts from the inventory).

**Acceptance:** `node scripts/check-bootstrap-surface.mjs` passes; the JSON's totals reconcile to the ground-truth counts above (small deltas allowed only with a comment in the extractor explaining the parse rule); every out-of-inventory entry carries a reason string.

### AL1.2 — The binding cross-walk (the judgment task)

**Depends:** AL1.1. **Files:** `packages/exporter-bootstrap/src/descriptors.js` (per-family descriptor data, PrimeNG-style: which slots each variable reads — `component.*` slot, semantic derivation, or a classification-with-note); a "component theming" section in [docs/specs/exporters/bootstrap.md](../specs/exporters/bootstrap.md) recording the contested calls the way P4's findings did; `docs/findings/bootstrap-component-crosswalk.md` listing the **AL2 promotion candidates** (every private derivation Bootstrap needed, so AL2 can check which ones PrimeNG's descriptors independently contain).

Work family by family in descending variable count (forms first — it's a fifth of the surface and will set the pattern for state variants: `-focus`, `-disabled`, `-checked`). Bind by meaning, not name (`$btn-padding-x` → `component.button.padding-x`; `$modal-content-border-radius` → a private `radius.overlay`-flavored derivation, **not** a new shared slot). Where Bootstrap's variable is a Sass expression of other variables (very common: `$btn-focus-box-shadow` chains), prefer binding the _root_ decision and classifying the chained variable `derived`.

**Acceptance:** every in-inventory variable appears in exactly one descriptor entry or classification; `node -e` spot-checks in the worklog for the five judgment-heaviest families; the promotion-candidates doc exists and cross-references PrimeNG's descriptor file per candidate.

### AL1.3 — Sass-path emission

**Depends:** AL1.2. **Files:** `packages/exporter-bootstrap/src/index.js` (component section in `_variables.transtyle.scss` generated from the descriptors; the line-169 blanket coverage entry **deleted**, replaced by per-family entries from the descriptor walk); `usage.md` template updated.

**Acceptance:** `npx transtyle build` in all four examples emits the component section deterministically (`check:determinism`); `check:fixtures` regenerated where affected; an authored `component.button.radius` in a scratch config visibly overrides the default in the emitted `$btn-border-radius` (worklog shows the diff); coverage report for bootstrap contains zero entries citing "reserved for the v2 component layer".

### AL1.4 — CSS-variable-path emission

**Depends:** AL1.3. **Files:** `packages/exporter-bootstrap/src/index.js` (`renderCss`: selector-scoped `--bs-<comp>-*` blocks for every inventoried variable with a CSS-var counterpart); the honesty note in the emitted CSS header + `usage.md` extended to state precisely which classes of values the CSS path cannot reach and why the Sass path exists.

**Acceptance:** the emitted CSS applied to a _stock_ (non-Sass-built) Bootstrap page restyles a button's padding/radius/colors per the demo check below; coverage distinguishes the two paths where their reach differs (same variable can be `native` via Sass and `dropped` via CSS-only — the report must say so per target instance, matching how the exporter already reports its two paths).

### AL1.5 — Prove it on the examples (authored-wins and defaults-only, both)

**Depends:** AL1.3 (Sass), AL1.4 (CSS). **Files:** `examples/acme/tokens/*` (author a small, visible `component.*` set — button radius/paddings at minimum — Acme is the authored-wins proof); Cathode/GOV.UK/Carbon stay **unauthored** (the empty-tier/defaults proof, per the C2 guarantee); the four `examples/*/demo/bootstrap` projects rebuilt.

**Acceptance:** all four demos build and render with no console errors (in-browser verification per repo convention); Acme's demo visibly reflects the authored values; `transtyle explain component.button.radius` shows authored provenance in Acme and `alias(radius.control)` derivation in Carbon; `check:component-tier` still passes (regression: the PrimeNG-era guarantees didn't move).

### AL1.6 — Docs closure + AL3 handoff

**Depends:** AL1.5. **Files:** [docs/specs/exporters/bootstrap.md](../specs/exporters/bootstrap.md) and `website/src/docs/exporter-bootstrap.md` (full component-theming documentation: what's driven, both paths, the honest limits); `README.md` (the Bootstrap line's claim updated); ROADMAP AL1 checked off with a dated note; the inventory + per-family coverage wired as the input AL3's bar consumes (AL3 decides the enforcement mechanism; this task only guarantees the data is complete and machine-readable).

**Acceptance:** `check:sync`, `check:docs`, `check:format`, `check:all` all pass; a reader of the website exporter page can answer "which `$btn-*` variables does Transtyle drive, via which path?" without reading source.

## Suggested model per task (judgment call, not a hard rule — same convention as the C-series)

| Task  | Suggested  | Why                                                                                                                                                                   |
| ----- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AL1.1 | **Sonnet** | Mechanical extraction + a diff guard that mirrors `check:fixtures`; the in/out rules are decided above.                                                               |
| AL1.2 | **Opus**   | The judgment core of the whole alpha: ~670 bind-by-meaning decisions with AL2 consequences, the direct analog of C1 — highest-ambiguity, gates everything downstream. |
| AL1.3 | **Sonnet** | Descriptor-driven emission into an exporter whose structure already does exactly this for the semantic tier.                                                          |
| AL1.4 | **Sonnet** | Same emission pattern, different render target; the reach/honesty analysis is settled by the inventory.                                                               |
| AL1.5 | **Sonnet** | Example wiring + demo verification, executed many times in this repo.                                                                                                 |
| AL1.6 | **Sonnet** | Docs propagation across known surfaces with existing checkers enforcing completeness.                                                                                 |

**On Fable:** per the standing note in [component-tier.md](component-tier.md) — no verified capability documentation to ground a recommendation on; check Anthropic's model docs before assigning it here.

## Explicitly out of scope for this plan

Promoting anything into `COMPONENT_CATALOG` or `semantic.*` (AL2, and only with PrimeNG cross-confirmation); the AL3 enforcement mechanism itself (this plan only feeds it); Bootstrap versions other than the pinned 5.3.x line; theming Bootstrap _plugins_ (icons, examples); any behavioral mapping — [component-layer.md](../specs/component-layer.md)'s "we will never generate component implementations" boundary is unchanged.
