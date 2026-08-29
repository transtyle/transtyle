# Validation, diagnostics, and coverage

> **Status (re-verified 2026-08-29):** the diagnostics collector, the 24 shipped
> `TST` codes, DTCG structural validation, contrast checking, the coverage
> classes, `report.json`, and `check --json` are **implemented**. Still specced:
> per-diagnostic source locations, config suppressions, tier-violation checks,
> exporter-declared mode support, the emitted-file drift manifest, and
> `--frozen`. Each is marked below rather than left for the reader to guess —
> this page had drifted into describing all of it in the present tense.

Translation between design ecosystems is lossy. Competitors hide this; we instrument it. The coverage report is the product's trust mechanism and its clearest differentiator ([prior-art.md](../prior-art.md)).

## Diagnostics

Every pipeline stage emits diagnostics into one collector; a run reports everything at once (no fix-one-rerun loops). Each diagnostic carries a stable code (`TST####`), a severity (`error | warning | info`), a message, and an optional `hint` rendered on its own `↳` line — message says what is wrong, hint says what to change, and they stay separate fields in `report.json` so editors and CI annotations can place them independently. Identical diagnostics de-duplicate on (severity, code, message): derivation runs once per mode combination, and a single authoring mistake used to be reported once per combination.

**Specced, not implemented:** per-diagnostic source locations (file:line via LOAD source maps — LOAD tracks the file a tree came from, but that never reaches the diagnostic), and config suppressions with a required `reason` string. Today a message names the offending token path, and the way to silence a diagnostic is to fix or author it.

Severity policy: **errors** = output would be wrong, and nothing is emitted (unresolvable alias `TST1105`, cycle `TST1104`, unparseable token file `TST1002`, schema violation `TST1010`/`TST1011`, a polarity axis that would drop dark mode `TST1112`). **warnings** = output is produced but deserves attention (contrast below the standard `TST2101`, a token defined twice across base layers `TST1103`, a mode value overridden by a later layer `TST1108`). **info** = notable but fine (a foreign `$extensions` namespace carried through `TST1304`, a role whose dark value is the light one carried over `TST1204`). Which severities fail a build is `check.failOn`, not the severity itself: a warning stops CI when you ask it to.

## Built-in checks (Phase 1)

Implemented:

- **Schema validity** — the config against `config/v0` (`TST1010`), each target's `options` against its exporter's own schema (`TST1011`), and every token file's DTCG structure (the table below).
- **Reference integrity** — dangling aliases (`TST1105`) and cycles with the full chain printed once per loop (`TST1104`).
- **Mode integrity** — a mode-scoped layer naming an undeclared mode (`TST1109`) or more than one dimension (`TST1110`), a mode value for a token with no default (`TST1107`), a later layer overriding a mode value (`TST1108`), and `color-scheme` declared after another dimension, which is an error because dark mode would otherwise silently never reach an exporter (`TST1112`).
- **Contrast** — every `<role>.on-solid`/`<role>.on-tint` pairing and `text`/`elevation.N.surface` pairing measured per mode against `check.contrast.standard` (`TST2101`; WCAG 2.1 AA default, AAA available). Accessibility is a compiler check, not a plugin.

Specced, not implemented:

- **Tier violations** — a semantic token aliasing a component token, an exporter binding below the semantic tier. Only the coarser "top-level group isn't a tier name" check exists today (`TST1305`).
- **Mode matrix completeness per exporter-declared mode support** — exporters do not declare mode support yet; a target that cannot express a dimension reports `dropped(mode:<dim>)` per value instead.
- **Drift detection** — emitted-file hashes against a `transtyle-manifest.json`, so a hand-edited generated file warns. No manifest is written today; the generated files carry a "regenerate, don't edit" header and nothing enforces it.
- **Lockfile freshness** (`--frozen`), and **APCA** as a contrast standard.

## DTCG structural validation (T10)

Runs per token file at LOAD, before merging (`packages/core/src/load.js`) — catches authoring mistakes the tree-walk that builds the IR would otherwise silently swallow (an empty group, an unrecognized `$type`, a stray `$extensions` namespace) rather than surfacing them only as a missing slot three stages later.

| Code      | Severity | Meaning                                                                                                                                                 | Remediation                                                                                                                       |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `TST1302` | error    | A node declares `$type` but has neither `$value` nor child tokens                                                                                       | Add the missing `$value`, or remove the node if it was a leftover placeholder                                                     |
| `TST1303` | —        | Alias to a non-existent path — this _is_ `TST1105` (dangling alias), not a new code; listed here because it's part of the same authoring-mistake family | Fix the `{...}` reference to point at a real token path                                                                           |
| `TST1304` | info     | An `$extensions` namespace this IR doesn't reserve (i.e. not `transtyle.*`)                                                                             | Nothing to fix — it's carried through untouched for the tool that owns it; informational only                                     |
| `TST1305` | warning  | A top-level group isn't `option`, `semantic`, or `component`                                                                                            | Move the tokens under the right tier, or confirm the typo in the group name                                                       |
| `TST1306` | warning  | A token's `$value` has an unrecognized `$type`                                                                                                          | Use one of the DTCG types the IR understands, or accept that this token is carried opaque (no parsing, no derivation eligibility) |

`transtyle check --json` prints the full diagnostics array (plus per-target coverage) to stdout as one JSON object — human logs still go to stderr, so both can run in the same invocation without interleaving (`docs/specs/cli.md` "Behavioral contracts").

## Coverage report

Produced per target in RESOLVE ([pipeline.md](../architecture/pipeline.md#4-resolve)). Every binding between an IR value and target output is classified:

| Class          | Meaning                                                        | Example                                                                                 |
| -------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `native`       | Target has a first-class slot; value passes through losslessly | `semantic.color.primary.solid → $primary`                                               |
| `derived`      | Value was synthesized by derivation, then mapped natively      | derived `secondary → $secondary`                                                        |
| `approximated` | Mapped, but meaning changed en route                           | cubic-bezier easing flattened to a keyword the target supports; oklch → hex gamut clamp |
| `dropped`      | IR expresses it; this target cannot; omitted with reason       | `density` mode for a target with no density concept                                     |
| `unsupported`  | Target has a themable slot the IR doesn't cover yet            | an exotic framework variable left at framework default                                  |

`dropped` and `unsupported` are opposite directions of mismatch — reporting both keeps us honest about the IR's limits, not just the targets'. `unsupported` entries across exporters are the data that drives semantic-catalog growth (an `unsupported` slot appearing in 3+ exporters is a catalog candidate).

### Coverage percentages are not comparable across targets

A target's coverage percentage measures how much of _its_ surface we drive. It does **not** rank targets against each other, because the ceiling is set by the target's theming architecture, not by how much work we've done. Re-measured 2026-08-29 on the two component-heavy targets, against `examples/acme` (every count below is re-derived on each `check:doc-numbers` run, and the parts are guarded rather than the totals — a sum can be right while both its halves are wrong):

<!-- measured: bootstrap.surface.total = 952 -->
<!-- measured: bootstrap.surface.component = 657 -->
<!-- measured: primeng.surface.total = 2759 -->
<!-- measured: primeng.surface.families = 98 -->
<!-- measured: acme.bootstrap.native = 59 -->
<!-- measured: acme.bootstrap.derived = 493 -->
<!-- measured: acme.bootstrap.approximated = 35 -->
<!-- measured: acme.bootstrap.dropped = 71 -->
<!-- measured: acme.bootstrap.unsupported = 56 -->
<!-- measured: acme.primeng.driven = 80 -->
<!-- measured: acme.primeng.inherited = 1552 -->
<!-- measured: acme.primeng.base = 1127 -->

|                                          | Bootstrap                                                               | PrimeNG                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Surface                                  | 952 variables (657 component-scoped)                                    | 2759 slots across 98 families                                        |
| Driven                                   | 59 native + 493 derived = 552 of 714 rows (77%), plus 35 `approximated` | 80 driven + 1552 inherited = 1632 (59%), 1127 left on Aura's default |
| Undriven                                 | 71 `dropped` + 56 `unsupported`                                         | see the family rows in `report.json`                                 |
| Reachable without new catalog vocabulary | **~0**                                                                  | **221**                                                              |

The 59% is the target with room to grow; the 77% is the one that has converged. The reason is architectural:

<!-- measured: acme.bootstrap.undriven = 127 -->

- **PrimeNG resolves `{token.path}` references at runtime**, so driving one semantic path cascades to every component slot pointing at it — a multiplier. Driving `formField.paddingX` alone reaches Button plus every form component. 1,552 of its covered slots are `inherited` this way, and 221 more sit behind 100 semantic paths this exporter drives only partially (`form.field.*` 125, `navigation.item.*` 65, `list.*` 21, `overlay.*` 10) — all expressible with catalog vocabulary that already ships.
- **Bootstrap's Sass path binds per variable**, with no multiplier. Its 127 undriven variables were measured group by group and every group fails for a structural reason, not for missing work. The five largest account for 98 of them: structural/behavioral options like cursor and order (29), Bootstrap's own shade/tint derivation knobs (18, made redundant by our own state derivation), `null` cascade no-ops on non-inherited properties (18), bespoke geometry already tested and rejected by [proposal 0004](../proposals/0004-component-geometry.md) (17), and embedded SVG assets (16). The remaining 29 sit in eleven smaller groups, the largest being per-component opacity values with no shared meaning (12) and concepts both reference targets model incompatibly (4).

Two consequences for reading the bar:

1. **Track a target against its own history, not against another target.** A drop in Bootstrap's number is a regression; Bootstrap being lower than a hypothetical 95% target says nothing.
2. **A ref-resolving target rewards semantic-tier work; a per-variable target rewards exporter-tier work.** The same engineering hour buys very different coverage depending on which side of that line the target sits.

A third consequence for the catalog: on a per-variable target, an `unsupported` slot is evidence the IR lacks a concept. On a ref-resolving target it may only mean the exporter hasn't driven a path it could — check which before reading it as catalog-growth signal.

## Report format

`report.json` (schema-versioned) per build, plus terminal rendering:

What the CLI actually prints, from `npx transtyle build shadcn --cwd examples/acme`:

```
shadcn  42% native · 53% derived · 3% approximated · 3% dropped
  ↳ dist/shadcn/globals.transtyle.css
  ↳ dist/shadcn/usage.md
  ↳ dist/shadcn/report.json

✔ build complete
```

Diagnostics print above that block, each as two lines — `✖`/`⚠`/`ℹ` with the code and message, then the hint on a `↳` line. (This section previously showed a mockup with a progress bar, a version-suffixed target name, and invented percentages; the renderer never produced any of it. The transcript above is checked against a real compile by `check:doc-numbers`.)

The JSON form is consumed by CI (thresholds via `check.failOn: error | warning | approximation`), `transtyle diff` (coverage regressions between DS versions are surfaced), and — planned — the preview site's badge rendering.

## Testing strategy (project-level)

- **Conformance fixture:** `@transtyle/plugin-kit` ships one canonical design system — 14 authored tokens, light and dark — and runs every plugin against it, asserting the contract rather than a snapshot: the `emit(ir, ctx)` shape, determinism across two runs, IR immutability, honest coverage classes, and a valid options schema. `check:plugins` gates all eight official exporters plus an inline third-party plugin with it, and third parties run the same function. It is deliberately small; catalog completeness is `check:grid`'s job (54 slots in both modes), and the wide, awkward inputs live in the four examples and `check:minimal-ds`.
- **Determinism gate:** `check:determinism` builds all four examples twice and byte-compares the trees; CI runs it on every push. Determinism is what makes every other check here meaningful — a coverage number is only evidence if the same input yields it again.
- **Ground-truth tests per exporter:** generated output is loaded by the _actual target toolchain_ — snapshot tests catch our regressions; ground-truth tests catch the framework moving underneath us. What exists: 32 demo projects (8 targets × 4 examples) build in CI on every push, which compiles the emitted Sass through Bootstrap's own build, type-checks the PrimeNG preset against PrimeNG's `DesignTokens` types, and boots the themed Storybook. What is still manual: looking at the result. Nothing yet asserts on a headless render — a demo that builds green can still be visually wrong, which is why the T11 review checklist is a human pass.
- **Property tests on derivation:** e.g. contrast-pick over a plain candidate list (`<role>.on-solid`) returns the max-contrast candidate; the `<role>.on-tint` on-brand walk returns an AA-passing candidate whenever one exists inside the lightness clamp and is monotone in its step count (this line previously overclaimed "always max-contrast", contradicting the rule's on-brand intent — caught and fixed by [exercise F19](../exercises/phase0-shadcn-rerun.md)); scales are monotonic; OKLCH ramps stay in gamut after clamping.
