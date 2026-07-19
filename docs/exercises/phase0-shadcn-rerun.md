# Phase 0 paper exercise — round 4: shadcn clean re-run

**Date:** 2026-07-19 · **Status:** complete, one amendment (F19) · **Exit criterion:** NOT met — counter reset to 0

Method: re-execute round 1 ([phase0-shadcn.md](phase0-shadcn.md)) against the **amended** specs (post F1–F8) and — new since round 1 — against the **real shadcn exporter**, which now exists. The re-run therefore had two probes instead of one: (a) does the paper mapping still go through with no amendments, and (b) does the hand-derived expectation agree with what the compiler actually produces? Probe (b) is stronger, and it is the one that found something.

Findings continue the shared numbering; this round produced F19 plus two recorded hand-run corrections.

## Probe (a): paper mapping against amended specs — clean

The 33-variable mapping table re-traversed with the current [ir.md](../architecture/ir.md) and [derivation.md](../architecture/derivation.md): all round-1 classifications stand. F1's `text-on-<role>.{base,subtle}` scale, F2's `overlay`/`scrim` split, and F3's ring rule are now plain catalog reads — no friction, nothing new needed. F8's radius ramp does not disturb shadcn (the exporter emits shadcn's own `calc()` convention per F5). One cross-target consistency observation recorded, no amendment: a DS authored at `radius.md ≠ 0.5rem` gets slightly different sm/lg/xl radii in shadcn (`±px` calc) than in Bootstrap (multiplicative ramp) — resolvable at exporter level (a future `radiusScale: "native" | "convention"` option), and coverage classification (`exporter-convention`) already tells the truth about it.

## Probe (b): hand expectation vs real compiler output — found F19

Value-level comparison of [expected/shadcn/globals.transtyle.css](../../examples/acme/expected/shadcn/globals.transtyle.css) against `dist/shadcn/globals.transtyle.css`: structure matched 100% (33 `:root` / 32 `.dark` / 38 `@theme` variables, none missing, none extra). Value deltas fell into three classes:

1. **Hand-rounding noise** (expected, documented in round 1): chroma/lightness off by ≤0.01 (`--accent` 0.02 vs 0.017 chroma, `--muted` 0.96 vs 0.95, dark mix results 0.3 vs 0.246 — the hand-run used gray.800 as a stand-in for a real mix). Not findings.
2. **Hand-run errors, corrected:** dark `--destructive` — round 1 wrote "danger.hover used as dark base," but no rule says that; under `autoDark: false` with brand unchanged, derived roles are identical across modes, and the compiler is right. Also the hand-run wrote the subtle mix as ≈0.88; the ratified rule-pack constant is **0.92**.
3. **A real three-way inconsistency → F19.**

**F19 — Rule-pack ambiguity (accepted): `contrast-pick(subtle)` had three conflicting definitions.** `derivation.md` said on-brand candidates are preferred (F1's intent); the property-test example in `validation-and-coverage.md` said contrast-pick "always returns the max-contrast candidate"; the implementation did neither — first-AA-pass over a fixed list `[active, text, white, near-black]`. The three disagreed exactly where it matters: when `role.active` *barely* misses AA. Measured on Acme's dark mode: active at L 0.62 hits 4.40:1 — a hair under 4.5 — so the implementation punted to plain text color (0.985), losing the on-brand foreground F1 exists to provide, while one more lightness step (L 0.63) would have cleared AA at 4.58:1 on-brand.

**Amendment (ratified in spec and code together, per the sync rule):** the **on-brand walk** — start at `<role>.active` (state-consistent on-brand candidate), step OKLCH lightness away from the subtle background in deterministic 0.01 increments until the pair clears AA; fall back to max-contrast among `text`/white/near-black only if the lightness clamp is reached; the AA hard-rule warning now fires for `subtle` pairings too (it previously only covered `.base`). Applied to [derivation.md](../architecture/derivation.md), the property-test line in [validation-and-coverage.md](../specs/validation-and-coverage.md), `packages/core/src/derive.js`, and the website derivation page.

Behavioral consequences, verified by rebuild: **light-mode output byte-identical** (every light `active` candidate already cleared AA — the celebrated on-brand picks are untouched); dark-mode subtle foregrounds become on-brand (`--accent-foreground` dark: 0.985 plain → oklch(0.63 0.162 255) lightened brand; `--secondary-foreground` dark: near-white → mid-light gray at 4.6:1). Determinism gate re-verified (double build, byte-identical); both examples build; `check` passes. The frozen `palette.categorical.1–5` contract is untouched.

## Verdict

**The counter resets to 0.** F19 is a rule-pack semantic amendment — same class as F3 and F8, which both reset the counter, and it would be gaming the criterion to reclassify it as "just a code bug" when the spec genuinely contradicted itself.

Worth stating plainly: **round 4 found F19 only because a real compiler existed to disagree with the paper.** Probes of type (a) — re-reading one's own specs — passed cleanly and would have kept passing; the ambiguity was invisible until two independent executions of the same rule (hand and machine) produced different bytes. Rounds 5+ therefore get a protocol upgrade: every future round and re-run must diff hand expectations against compiler output where an exporter exists, and the exit criterion's "attempt" is redefined accordingly (an attempt = paper mapping + output diff, both clean).

Next: **round 5 — shadcn re-run under the post-F19 rule pack** (probe (b) should now agree by construction on light mode and needs fresh hand-verification of the dark walk), then the Bootstrap re-run. The counter needs 2; current honest count: 0.
