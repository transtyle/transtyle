# Worklog — `transtyle diff`: contrast-regression flagging

**Task:** the follow-on noted in [docs/specs/diff.md](../specs/diff.md)'s scope section after P6.

## What it adds

`diff` now reports the **accessibility cost of a change**. `check` answers "is contrast bad now?"; diff answers "did _this change_ make it bad?" — the reviewer's actual question, and the one a green CI baseline can silently regress on.

```
⚠ Contrast regressions:
  ✖ text.base on elevation.0.surface (light): 18.1:1 → 2.2:1 — now FAILS 4.5:1
  4 pairs passed before this change and fail after it.
```

Two severities: `regressed` (passed the standard before, fails now — the headline) and `worsened` (already failing, ratio dropped further). Pairs that improve or fail identically on both sides are **not** reported, so an unrelated change reports nothing (verified: a brand-colour change flags none).

## Design

`contrastRegressions(before, after, config)` in `core/src/diff.js` reuses `runChecks`' pair list and threshold via new shared exports from `checks.js` (`CONTRAST_PAIRS`, `contrastThreshold`, `pairRatio`) — so `check` and `diff` cannot disagree about what "passing" means, and extending the pair list benefits both by construction.

**No new exit code.** A contrast regression implies a semantic change, which already exits 1; CI needing an a11y-specific gate reads `contrastRegressions` from `--json`. One meaning for exit 1 is worth more than a second signal (rationale recorded in the spec).

## Latent bug fixed en route

`check.contrast.standard: "wcag21-aaa"` was accepted by the config schema and printed in the diagnostic message, but `runChecks` **always compared against 4.5** — so AAA projects got AA enforcement and a message reading "5.7:1 (< 4.5:1 wcag21-aaa)". `contrastThreshold()` now honors it (AAA → 7:1) in both `check` and `diff`; verified a mid-gray that passes AA correctly fails AAA in both. No example uses AAA, so no in-repo output changed.

## Verified

Golden tests in `check:cli` cover both directions (brand-only change → no flag; lightened `text.base` → flagged, with `--json` asserting `before > after` and `status: 'regressed'`). `check:all` 57 ✔ exit 0.
