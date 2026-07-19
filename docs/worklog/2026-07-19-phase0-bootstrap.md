# Worklog — 2026-07-19 — Phase 0 round 2: Bootstrap paper exercise

**Roadmap item:** Phase 0 IR validation, round 2 of the hand-translation exercise ([ROADMAP.md](../../ROADMAP.md) Phase 0, third bullet).

## What was done

1. **Hand-executed the pipeline** (normalize → derive → resolve → emit) for the Acme fixture against the [Bootstrap exporter spec](../specs/exporters/bootstrap.md) (`>=5.3 <6`), covering both consumption paths the spec defines. The fixture was deliberately left unchanged from round 1 so friction differences are attributable to the target.
2. **Expected outputs written** (the specification the future Bootstrap exporter will be checked against), with full inline provenance comments, in [examples/acme/expected/bootstrap/](../../examples/acme/expected/bootstrap/):
   - `_variables.transtyle.scss` — Sass overrides incl. Bootstrap 5.3 `*-dark` variables;
   - `_maps.transtyle.scss` — the six 5.3 maps (`$theme-colors-text`/`-bg-subtle`/`-border-subtle` × light/dark) replacing Bootstrap's sRGB derivations with our OKLCH values;
   - `bootstrap-theme.css` — the documented lower-fidelity CSS-variable path.
3. **Exercise report** with findings F8–F13 (numbering continues round 1): [docs/exercises/phase0-bootstrap.md](../exercises/phase0-bootstrap.md). Headlines:
   - **F9 — round 1's prediction confirmed:** F1's `text-on-<role>.subtle` binds natively onto `-text-emphasis`; the amendment was general, not shadcn-shaped.
   - **F8 — one rule-pack amendment accepted:** standard@1 had no radius-scale derivation from a single authored `radius.md` (shadcn masked this via its `calc()` convention). Multiplicative ramp added to [derivation.md](../architecture/derivation.md).
   - **Zero semantic-catalog (ir.md) changes** — the first round to need none; all three round-1 amendments found second consumers and held.
   - F10–F13: per-role border tints (watch item), Bootstrap's inverted surface ladder (possible future `surface-sunken`, 1 target so far), `$light`/`$dark` as exporter convention (first real consumer of the role scale's `contrast` position), and a precise statement of the Sass-path vs CSS-path fidelity boundary including the `$link-color-dark` emission asymmetry.
4. **Verdict:** exit criterion still unmet — F8 resets the two-clean-attempts counter. Next: Storybook round, then clean shadcn and Bootstrap re-runs.

## Spec/doc sync (CONTRIBUTING.md sync rule)

- Code: n/a — paper exercise; no Bootstrap exporter exists yet (Phase 1 scope).
- Specs: `derivation.md` amended (F8 rule row); exercise report added.
- Website: `roadmap.md` Phase 0 sequencing paragraph updated.
- README (repo): n/a — no capability change. Acme example README updated to describe `expected/bootstrap/`.
- Examples: expected outputs added under `examples/acme/expected/bootstrap/`; no buildable-target change.

## Not done (deliberately)

- No `ir.md` edit — the round required none (that is the round's main result).
- The Bootstrap exporter implementation remains Phase 1 work; the expected files are its acceptance fixture, mirroring how round 1's shadcn file preceded the shadcn exporter.
