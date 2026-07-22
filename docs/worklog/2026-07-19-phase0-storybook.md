# Worklog — 2026-07-19 — Phase 0 round 3: Storybook paper exercise

**Roadmap item:** Phase 0 IR validation, round 3 of the hand-translation exercise ([ROADMAP.md](../../ROADMAP.md) Phase 0, third bullet).

## What was done

1. **Hand-executed the pipeline** for the Acme fixture against the [Storybook exporter spec](../specs/exporters/storybook.md) (`>=8 <10`) — the meta-target round. Composition was exercised against the _real_ sibling artifacts in `examples/acme/dist/` (shadcn's `.dark` class, daisyUI's `data-theme` attribute — two different mode encodings driven by one manifest-assembled decorator).
2. **Expected outputs written** with full inline provenance in [examples/acme/expected/storybook/](../../examples/acme/expected/storybook/): `theme.transtyle.ts` (ThemeVars light + dark), `manager.transtyle.ts` (chrome wears the DS's default mode, per the mode-polarity rule), `preview.transtyle.ts` (sibling stylesheet imports, `color-scheme` toolbar global, decorator, backgrounds/grid from tokens). The optional token-stories file was deliberately not hand-written — no paper-validation value (rationale in the report).
3. **Exercise report** with findings F14–F18: [docs/exercises/phase0-storybook.md](../exercises/phase0-storybook.md). Headlines:
   - **Zero amendments — the first clean attempt.** Exit-criterion counter: 1 of 2.
   - Round 2's prediction confirmed: friction was presentational, never semantic (F14).
   - **F15:** `textInverseColor` requires cross-mode reads inside one artifact — first hard evidence for the expanded-mode-matrix plugin API over per-mode slices.
   - **F16:** unit-conversion `approximated` class exercised for real; F8's radius ramp found a second consumer (`inputBorderRadius` ← `radius.sm`) one round after acceptance.
   - **F17:** boundary decision — brand identity metadata (`brandUrl`/`brandImage`) is not a token; exporter option at implementation time, `unsupported` in coverage when unset.
   - **F18:** the no-cross-target-coupling composition invariant held with two differently-encoded siblings.
4. **Verdict:** next is the clean shadcn re-run (round 4); if clean, the Phase 0 exit criterion is met, with a Bootstrap re-run as confirmation.

## Spec/doc sync (CONTRIBUTING.md sync rule)

- Code: n/a — paper exercise; no Storybook exporter exists yet (Phase 1 scope).
- Specs: **no spec edits needed** — that is the round's result. Exercise report added.
- Website: `roadmap.md` Phase 0 sequencing paragraph updated.
- README (repo): n/a — no capability change. Acme example README updated for `expected/storybook/`.
- Examples: expected outputs added under `examples/acme/expected/storybook/`; no buildable-target change.

## Not done (deliberately)

- No `ir.md`/`derivation.md` edits — none required.
- `tokens.stories.transtyle.tsx` deferred to exporter implementation (reasoning in the report).
- Storybook exporter implementation remains Phase 1 work; the expected files are its acceptance fixture.
