# Phase 0 paper exercise — round 2: Bootstrap

**Date:** 2026-07-19 · **Status:** complete, findings applied · **Exit criterion:** not yet met (counter reset by F8)

> **Note (2026-07-20):** the slot names used throughout this record (e.g. `.base`/`.subtle`/`.contrast`) predate the role-grid catalog revision — see `docs/adr/0010-pre-release-breaking-changes.md` and `docs/proposals/0001-universal-token-ir.md`. The _findings_ below (F1–F21) remain valid evidence; only the vocabulary changed.

Method per [ROADMAP Phase 0](../../ROADMAP.md): hand-execute the pipeline (normalize → derive → resolve → emit) for the [Acme fixture](../../examples/acme/) against the [Bootstrap exporter spec](../specs/exporters/bootstrap.md) (`>=5.3 <6`, both consumption paths). Bootstrap was chosen second deliberately: it is the hardest constraint set of the four reference targets (Sass compilation, an opinionated generated-derivation color model, its own dark-mode mechanism), and round 1 left a specific prediction to falsify — that F1's `text-on-<role>.subtle` amendment maps onto `-text-emphasis` and is therefore general, not shadcn-shaped.

Findings continue round 1's numbering (F1–F7 in [phase0-shadcn.md](phase0-shadcn.md)); this round produced F8–F13.

## Inputs

Same fixture as round 1: **Acme**, 11 authored semantic tokens, 15 option tokens, `standard@1`, `autoDark: false`. Unchanged since round 1 — deliberately, so friction differences between rounds are attributable to the target, not the fixture.

## Derivation trace (rules newly exercised this round)

Round 1's color-role trace ([phase0-shadcn.md](phase0-shadcn.md#derivation-trace-standard1-hand-applied)) carries over unchanged — Bootstrap consumes the same semantic values. Newly exercised by Bootstrap's variable surface:

| Filled slot                      | Rule                                         | Result                                                                |
| -------------------------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| `radius.{sm,lg,xl,full}`         | **rule did not exist**                       | **gap → F8**                                                          |
| type scale `size.md…4xl`         | modular(base, ratio), no authored inputs     | 1 / 1.25 / 1.563 / 1.953 / 2.441 / 3.052 rem — provenance `defaulted` |
| `space.*` → `$spacer`/`$spacers` | linear ×n, base 0.25rem                      | lands exactly on Bootstrap's map keys (0/.25/.5/1/1.5/3) — native     |
| `shadow.{sm,md,lg}`              | composed from `scrim` alpha ramps            | three ramps; `shadow.xl` has no Bootstrap slot → dropped              |
| `ring` → `$focus-ring-color`     | F3's rule, first real consumer beyond shadcn | `primary.base` at Bootstrap's conventional 0.25 alpha ✓               |
| per-role border tint             | no rule, no slot                             | exporter convention → F10                                             |
| `$light` / `$dark` theme colors  | no IR concept                                | exporter convention → F12                                             |

Diagnostics the hand-run would emit: `TST2101` (text-muted borderline AA) resurfaces identically — same fixture value, same check.

## Mapping summary

Expected outputs with full inline provenance: [examples/acme/expected/bootstrap/](../../examples/acme/expected/bootstrap/) — `_variables.transtyle.scss`, `_maps.transtyle.scss` (Sass path), `bootstrap-theme.css` (CSS-var path).

Hand-counted Sass-path coverage over ≈99 emitted variables and map entries: **~22% native/authored · ~55% derived · ~15% exporter-convention · ~8% defaulted**. Dropped: `shadow.xl`, motion (Bootstrap themes almost none of it, per spec). Unsupported (Bootstrap slots the IR can't fill): `$box-shadow-inset`, `$display-font-sizes`, grid/breakpoints, component-tier `$btn-*`. Zero semantic-catalog color slots went unmapped — the derivation-heavy share (vs shadcn's 12-of-33) reflects Bootstrap's much larger generated-variable surface, not worse fit.

All Sass/hex emission stayed inside sRGB gamut for this fixture (8-bit rounding, classified native); a clamp would have been `approximated` per [validation-and-coverage.md](../specs/validation-and-coverage.md).

## Findings

**F9 — Prediction confirmed: F1 was general.** Bootstrap 5.3's `$theme-colors-text` map (→ `-text-emphasis` variables) is exactly `text-on-<role>.subtle`, and `$theme-colors-bg-subtle` is exactly `<role>.subtle` — both bind **native**, in both modes, with our OKLCH derivations _replacing_ Bootstrap's sRGB `tint-color()`/`shade-color()` output as the exporter spec intended. This was the round's falsifiable prediction and it held; F1's amendment needs no rework. (Numbered out of order because it's the headline.)

**F8 — Rule-pack gap (accepted): no radius-scale derivation from a single authored radius.** Bootstrap needs concrete `$border-radius-{sm,lg,xl,pill}` values; standard@1 had no rule producing them from `radius.md`. shadcn masked this gap in round 1 because its convention derives the scale by `calc()` in the consumer file (F5). **Amendment:** multiplicative ramp — `none = 0`, `sm = md × 0.5`, `lg = md × 1.5`, `xl = md × 2`, `full = 9999px` (exporters may re-express in their own idiom, e.g. Bootstrap's `50rem` pill). Multiplicative rather than fixed offsets so the ramp stays sane at any authored `md`. Applied to [derivation.md](../architecture/derivation.md). _Watch item:_ Bootstrap's `$border-radius-xxl` has no IR slot; emitted as exporter convention (`xl × 2`) — first target wanting a `2xl` step, not yet a catalog slot per the 3-exporter rule.

**F10 — Not a gap (watch): per-role border tints.** `-border-subtle` wants a border-strength tint of each role; the IR has neither a per-role border slot nor a rule. Emitted as exporter convention `mix(role.base, surface, ≈0.70)`. Second entry in the F4-style watch list (shadcn's `--input` was the first, but that was a _generic_-border distinction — these are different concepts and are tracked separately).

**F11 — Surface-model friction (open, not blocking): Bootstrap's background ladder runs the other way.** `--bs-secondary-bg`/`--bs-tertiary-bg` step _away_ from the body background in light mode (alternate/sunken surfaces for hovers, disabled fills, offcanvas), while the IR's only non-base surface concept, `surface-raised`, steps _toward_ white. Mapped `tertiary-bg ← surface.base` (native) and `secondary-bg ← neutral.subtle` (approximated — it's a fill tint standing in for a sunken surface). If a second target distinguishes raised-vs-sunken surfaces, a `surface-sunken` catalog slot becomes a candidate; one target is not enough.

**F12 — Not a gap: `$light` / `$dark` theme colors.** A Bootstrap historical-ism (grayscale roles predating the 5.3 semantic variables), not a missing IR concept. Exporter convention: `$light ← neutral.subtle`, `$dark ← neutral.contrast`. First real exercise of the `contrast` position in the role scale — it existed in the catalog since v0 with no consumer until now.

**F13 — Fidelity boundary documented (not a gap): who derives what, per path.** Three regimes, now stated precisely instead of hand-waved: (a) **token tier, Sass path** — our values _replace_ Bootstrap's derivations via the 5.3 maps (F9); (b) **component tier, Sass path** — Bootstrap still re-derives internally (button hover via sRGB `shade-color()`, button text via its own `color-contrast()`) from our `$primary`; acceptable until the v2 component tier, and the ground-truth test asserts the drift stays small; (c) **CSS-var path** — compiled component literals are unreachable entirely; the layer rethemes utilities/helpers/body only. Concrete asymmetry worth recording: the Sass path deliberately does _not_ emit `$link-color-dark` (Bootstrap's own tint of our `$primary` fills it — no invented dark brand value, consistent with F7), but the CSS path _must_ emit `--bs-link-color` in dark, because CDN users have stock-blue literals baked in. Same policy, opposite emissions, both explainable — exactly what provenance is for.

**F7 revisited (still open, pressure reduced):** Bootstrap's own dark mode keeps `$primary` constant — only emphasis/subtle derivations flip. That is precisely Acme's compiled behavior under `autoDark: false`, so the "should standard@2 add `darkBrandAdjust`?" question loses urgency: the hardest reference target agrees with our default. Still open pending ECharts/Storybook input.

**Positive result worth recording:** `$secondary` — stock Bootstrap ships a flat gray; ours is a desaturated rotation of the brand hue. Same class of quality win as round 1's brand-tinted `--accent`, now demonstrated on the second target. The demo story ("derived themes are _more_ on-brand than hand-copied ones") generalizes.

## Verdict

**Zero semantic-catalog (ir.md) changes** — the first round to need none; F1/F2/F3's round-1 amendments all found second consumers here and held. But the round produced **one accepted rule-pack amendment (F8)**, so per the exit criterion the counter resets again: two consecutive clean attempts are still required. The IR core looks increasingly solid; the residual risk has moved down a level, into rule-pack completeness against targets that need concrete values where shadcn accepted conventions.

Predictions to check in later rounds: **Storybook** (next) is a meta-target — expect friction in mode _presentation_ (toolbar switching) rather than token semantics; if it demands new slots, that's a surprise worth taking seriously. The **clean re-runs** (shadcn, then Bootstrap) must produce these same outputs with no amendments for the Phase 0 exit criterion to be met.
