# Implementation plan — the component tier (PrimeNG as the forcing function)

**Audience: any implementer, including lower-capability AI models.** Every task below is self-contained: exact files, exact acceptance commands. Do not improvise where this document specifies; where it is silent, follow the referenced spec or [proposal 0002](../proposals/0002-component-theming-primeng.md), and if still ambiguous, stop and ask rather than invent. Authority chain: [ADR-0003](../adr/0003-tokens-first.md) (component layer deferred to v2, preconditions) → [component-layer.md](../specs/component-layer.md) (the v2 sketch) → [proposal 0002](../proposals/0002-component-theming-primeng.md) (the PrimeNG evidence + strategy) → this plan.

**This is a prototype, not a v2 launch.** ADR-0003's preconditions for a _mature, frozen_ component tier (IR survived ≥1 year unrevised; ≥3 community exporters; ≥2 hand-written component-theming prototypes to generalize from) are not met — this plan doesn't claim they are. Building one real, working PrimeNG exporter _is_ the evidence-gathering activity those preconditions describe, per proposal 0002 §1: "this proposal treats a PrimeNG exporter as that prototype, not as jumping the gate." Nothing here updates ADR-0003's status, freezes `component.*`'s shape, or declares Phase 4 begun — a second independent prototype (a different component-heavy target) is still the trigger for that conversation, not this one.

**Non-negotiable process for every task (from CONTRIBUTING):**

1. One task = one commit series ending in a push to `main`; commit message starts `feat:`/`fix:`/`docs:` and names the task id (e.g. `feat: C2 …`).
2. Before committing: `npm run check:sync` passes; `npm run check:all` passes; determinism holds.
3. The **sync rule** applies once (and only once) `primeng` is registered in the CLI's exporter registry (C6) — before that, the exporter is real, tested code that simply isn't wired into the officially-supported surface yet, exactly like any exporter under active development. Don't register it early just to "be consistent" — `check-sync.mjs` would then correctly demand docs/demos that don't exist yet, for no benefit.
4. Worklog: add or extend a `docs/worklog/<date>-<task>.md` entry describing what was done and any deviation from this plan (deviations require a stated reason).
5. **The meta-language principle applies to every task below** (`CONTRIBUTING.md`, `docs/architecture/ir.md`): translate by meaning, not name; new shared derivation logic starts exporter-private; nothing gets promoted into the shared semantic catalog without a second independent exporter needing the identical thing.

**Task states are tracked in the ROADMAP ledger** (a new "Component tier (prototype)" section, added in C1). Execute strictly in order unless a dependency note says otherwise — C2 explicitly does not block on C1.

**Suggested model per task** (a judgment call, not a hard rule — re-evaluate if a task turns out harder or easier than it reads here):

| Task                                            | Suggested                                                                                                                                                                                                                                            | Why                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1 — cross-ecosystem study                      | **Opus**                                                                                                                                                                                                                                             | Open-ended synthesis across several documentation sources plus a genuine judgment call ("is this convergent or coincidental?") with long-term consequences (it gates C7). The highest-ambiguity, lowest-specification task in this plan — exactly where the strongest reasoning model earns its cost.                                                                                                  |
| C2 — engine resolution                          | **Sonnet**                                                                                                                                                                                                                                           | Well-specified, mirrors an existing pattern (`rc`/`rd` resolve-or-fill) in a codebase already deeply understood this session. Design decisions are made in this doc; the work is careful, correct implementation, not judgment.                                                                                                                                                                        |
| C3 — severity-grid mapper + ramp projector      | **Sonnet**                                                                                                                                                                                                                                           | Adapts two already-proven techniques (the Radix ramp projection, the role-grid cell-name translation) to a new but structurally analogous target. Precedented, not novel.                                                                                                                                                                                                                              |
| C4 — extend mapper across components            | **Sonnet** (Haiku _not_ recommended)                                                                                                                                                                                                                 | High-volume but low-complexity-per-item — writing ~25–35 small descriptors and verifying each against real source. Keep it at Sonnet rather than delegating to a faster/cheaper model: accuracy against real upstream data matters more than speed here, and shape variance between components ("Tag has no hover state") needs real reading comprehension per component, not just pattern repetition. |
| C5 — archetype helpers + structural residue     | **Sonnet**                                                                                                                                                                                                                                           | Same category as C3/C4 — implementing an already-sketched design (proposal 0002 §4) for real.                                                                                                                                                                                                                                                                                                          |
| C6 — official launch (incl. first Angular demo) | **Sonnet**, with **Opus** as a fallback specifically for Angular-idiom debugging                                                                                                                                                                     | The five-surface-sync mechanics are pure repetition of a pattern executed 8 times already this session. The one real unknown is Angular tooling conventions (new to this repo) — if that surfaces genuine framework-specific difficulty, escalate just that sub-problem, not the whole task.                                                                                                           |
| C7 — conditional promotion                      | **Sonnet** to implement, but treat the _decision_ ("was the convergence bar really met?") as worth a second look — optionally by **Opus** — before committing, since it's catalog-shape-adjacent and harder to walk back once exporters depend on it | Mirrors T7/T8's difficulty level, which Sonnet already handled well this session; the promotion judgment itself is the one higher-stakes call in an otherwise mechanical task.                                                                                                                                                                                                                         |

**On Fable:** I don't have solid, verified documentation of what Claude Fable is specifically tuned for — my system prompt lists it as a peer of Opus/Sonnet/Haiku in the current model family, without capability detail I can respond on confidently. Rather than guess, I'd check Anthropic's current model documentation for Fable's stated strengths before assigning it a task here; I'm not comfortable recommending it for anything specific in this plan without that grounding.

---

## C1 — The cross-ecosystem component-tier study

**Depends:** nothing. **Files:** a new `docs/findings/component-tier-study.md`; amendments to [proposal 0002](../proposals/0002-component-theming-primeng.md) §2.8/§3/§6 recording what changed.

Proposal 0001's 14-ecosystem study explicitly deferred component-tier depth. Proposal 0002's `field`/`list`/`navigation`/`overlay` grouping is validated against exactly one ecosystem (PrimeNG) plus one spot-check (Spectrum, which disagreed). Do the real pass, at proposal-0001's rigor, scoped to component-tier architecture specifically, against ecosystems proposal 0001 already named but didn't study at this depth:

- **Material 3** — the `comp` tier (`docs/proposals/0001-universal-token-ir.md` §2.1 already flags it as "the canonical three-tier").
- **Fluent 2** — "global → alias (→ per-control)."
- **Ant Design v5** — its explicit component tier.
- **Chakra v3 / Panda CSS** — "recipes ≈ component tier as functions"; check whether Panda's _slot recipes_ converge on anything `formField`/`list`-shaped.
- Reuse the Spectrum finding already in proposal 0002 §2.8 rather than re-deriving it.

For each: does it group shared component tokens into named objects (PrimeNG-style) or a flat precisely-named vocabulary (Spectrum-style) or something else? Which concepts, if any, appear in 3+ of the 6 systems studied (PrimeNG, Spectrum, Material 3, Fluent 2, Ant Design, Chakra/Panda)?

**Acceptance:** `docs/findings/component-tier-study.md` exists with one subsection per ecosystem (facts + a source citation, matching proposal 0001's "verify values against upstream" discipline) and a closing verdict table: for each of `field`/`list`/`navigation`/`overlay`/`content`, either "convergent — promote to `semantic.*`" (with the ecosystems that agree) or "not convergent — stays exporter-private." Proposal 0002 updated to link it and reflect the verdict. This task produces **no code change** — it only informs whether C7 promotes anything.

---

## C2 — Component-tier engine resolution (generic, not PrimeNG-specific)

**Depends:** nothing (proceeds independently of C1 — see header). **Files:** `packages/ir/src/index.js` (a `COMPONENT_CATALOG` constant — start with just `button`'s shape, extended by C4), `packages/core/src/normalize.js` (collect `component.*` tokens the same way `semantic.*` already is — no special-casing needed if the existing tier-agnostic walk already handles it; confirm, don't assume), `packages/core/src/derive.js` (resolve `component.*` tokens with the existing resolve-or-fill `rc`/`rd` pattern: an authored `component.button.radius` wins; an absent one is filled from whatever the exporter's shape descriptor says it defaults from), `scripts/check-component-tier.mjs` (new — asserts an **empty** `component` tier still compiles Acme cleanly, i.e. the tier is purely optional refinement, per `component-layer.md`'s existing principle).

This is the one part of the plan that's genuinely `component.*`-tier engine work rather than PrimeNG-exporter work — it's what turns ir.md's "RESERVED for v2 — parsed, carried, unused" into something real, scoped to exactly what proving Button needs (not the full 15-component `component-layer.md` sketch).

**Acceptance:** `node scripts/check-component-tier.mjs` passes on Acme with zero `component.*` tokens authored (confirms the empty-tier-compiles guarantee) and with one authored (`component.button.radius`) overriding a default (confirms authored-wins). `check:all` unaffected (regression guard — this must not touch `semantic.*` resolution at all).

---

## C3 — `packages/exporter-primeng`: the generic severity-grid mapper + ramp projector, proven on Button

**Depends:** C2. **Files:** new `packages/exporter-primeng/{package.json,src/index.js,src/severity-grid.js,src/ramp.js}`. **Not registered in the CLI yet** (see process note 3).

- `severity-grid.js`: one function, `mapSeverityGrid(map, { variants, parts })`, translating PrimeNG's `variant × severity × state × part` onto `semantic.color.<role>.<cell>` per proposal 0002 §5.2's cell-name table (`solid↔root`, `outline↔outlined`, `text↔text`, `on-solid↔contrast`), iterating `COLOR_ROLES` plus any role in `normalized.roleArchetypes` (T7) for the `severity` axis, and reading each archetyped role's `extend`-block output too (proposal 0002 §2.7).
- `ramp.js`: adapts `exporter-radix`'s grid→12-step projection technique to PrimeNG's 11 steps (different step count, different mix ratios — same underlying method, reuse don't reinvent) for `semantic.primary`/`semantic.surface`.
- `index.js`: emits a `definePreset(Aura, { semantic: {...}, components: { button: {...} } })`-shaped TypeScript module (`.ts`, since PrimeNG presets are TypeScript objects) — Button only. Coverage report distinguishes what Transtyle drove (native/derived) from what's silently inherited from the `Aura` base (a `dropped`-adjacent class, or a new note — decide during implementation, document the choice).

**Acceptance:** a standalone Node script (temporary, in this task, not a permanent fixture) builds the exporter against Acme and Cathode directly (bypassing the CLI registry) and asserts: the generated module is syntactically valid TypeScript (a lightweight check, not a full `tsc` dependency — e.g. balanced braces + no `undefined` literals leaking into values); `button.colorScheme.light.root.primary.background` in the output matches `semantic.color.primary.solid`'s resolved hex; a contrast-computed severity (`success`/`warning`/`danger`/`info`) is brand-coherent (hue-anchored off `primary`), not `sky`/`green`/`orange`/`purple`'s literal defaults (proposal 0002 §2.5 — the one place Transtyle's model should deliberately _not_ match Aura's own default).

---

## C4 — Extend the mapper across severity-colored components

**Depends:** C3. **Files:** `packages/exporter-primeng/src/components/*.js` (or one `descriptors.js` — decide during implementation which reads better at ~30 entries), one shape descriptor per component (proposal 0002 §5.2: `{ variants: [...], parts: [...] }`, a few lines each, **not** a value table).

Work through PrimeNG's component list (fetch fresh from `github.com/primefaces/primeng/tree/master/packages/themes/src/presets/aura`, since proposal 0002's ~25–35 estimate was a first pass, not a verified count) and add a descriptor for every component that follows the severity-colored `variant×severity×state×part` shape. Expected candidates from proposal 0002 §5.2: Button, Tag, Badge, Message, InlineMessage, ProgressBar, Checkbox, RadioButton, ToggleSwitch, SelectButton, Slider, Knob, Rating, Chip. Verify each against its actual source file — component shapes vary (some lack a `text` variant; Tag has no hover state) — don't assume Button's shape generalizes uniformly.

**Acceptance:** every descriptor added produces a `components.<name>` block in the generated preset via the _same_ `mapSeverityGrid` call from C3 (zero new mapping logic per component beyond the descriptor); spot-check 3 components' output against their real Aura defaults' _shape_ (which fields exist), not necessarily values (values legitimately differ — Transtyle's are brand-derived).

---

## C5 — Exporter-private archetype helpers + structural residue

**Depends:** C3. **Files:** `packages/exporter-primeng/src/archetypes.js` (the `field`/`list`/`navigation`/`overlay` helpers sketched in proposal 0002 §4 — implemented for real now, reading `space.*`/`radius.*`/`border`/`text.*`/`elevation.*` directly), applied to the structural residue components (DataTable, Galleria, Tree, Splitter, …) for whatever dimensional (non-color) tokens they need.

Per C1's verdict: if a group was found convergent, this task still ships it exporter-private first (no engine dependency on C1 finishing) — promotion to `semantic.*` is a **separate**, later task (C7), never bundled into shipping the exporter.

**Acceptance:** `field`/`list`/`navigation`/`overlay` helpers used by at least one real component each (Button for `field`, a select/listbox-shaped component for `list`, a menu component for `navigation`, Dialog or Popover for `overlay`); structural components with no severity-colored surface get `dropped`/`unsupported` coverage entries with an honest note for whatever they still lack, matching every other exporter's honesty convention.

---

## C6 — Official launch: CLI registry, docs, demo projects (all four examples, one commit)

**Depends:** C3, C4, C5. **Files:** `packages/cli/src/main.js` (register `primeng`), `docs/specs/exporters/primeng.md`, `website/src/docs/exporter-primeng.md` + `nav.js` + `roadmap.md`, `README.md`, `scripts/check-sync.mjs` (NAMES entry), `examples/{acme,cathode,govuk,carbon}/transtyle.config.json` (add the target), and — the new thing — `examples/{acme,cathode,govuk,carbon}/demo/primeng/` (Angular, first non-Vite/React demo profile in the repo; extend `docs/specs/demo-app.md` with an Angular profile: standalone components, `providePrimeNG` in `app.config.ts`, same "Nimbus Console" fake-page content as every other demo, ported to Angular templates).

This is the one commit where `check-sync.mjs`'s all-five-surfaces-at-once rule is unavoidable — register the exporter and every surface must exist in the same series, exactly as the rule requires for every prior exporter.

**Acceptance:** `npm run check:sync` clean across 8 exporters × 4 examples; all four `examples/*/demo/primeng/` projects build and run (`npm run dev -w <example>-demo-primeng`); `.claude/launch.json` and `.github/workflows/ci.yml`'s demo matrix updated (28 → 32 entries); in-browser verification per this project's established pattern (screenshot each, confirm brand colors + no console errors) — Angular's dev-server output differs from Vite's, verify the `predev`/`dev` script shape still matches the spec once adapted.

---

## C7 — Promote confirmed archetype groups (conditional — only if C1 found convergence)

**Depends:** C1, C6. **Files:** `docs/architecture/ir.md` (new `semantic.*` groups, only the ones C1's verdict confirmed), `packages/core/src/derive.js` (derive them from existing cells, same as any other semantic addition — see T7/T8 for precedent), `packages/exporter-primeng/src/archetypes.js` (now reads the shared semantic group instead of deriving privately) — **skip this task entirely if C1 found no convergence**; exporter-private is a permanent, fine end state, not a placeholder.

**Acceptance:** the promoted group resolves identically whether authored or defaulted (regression: `exporter-primeng`'s output must not change); `check:grid` extended if the group affects any frozen value; worklog explains which ecosystems converged and why the promotion bar was met.

---

## Deferred (explicitly out of scope for this plan)

The full `component-layer.md` 15-component catalog (this plan only reaches whatever C4's real audit finds — likely 25–35 PrimeNG components, not a fixed 15); a second component-heavy exporter (MUI, Chakra) — proving the pattern generalizes _twice_ is what would actually justify declaring v2 begun, and is future work, not this plan; PrimeNG's other three built-in presets (Material/Lara/Nora) — Aura only, as the base to override; Spectrum, Fluent, or Ant Design exporters — C1 studies them for vocabulary, doesn't build for them.
