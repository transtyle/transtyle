# 2026-07-20 — T10: DTCG validation UX

Per [docs/plan/catalog-revision.md](../plan/catalog-revision.md) T10. Picked up right after T8 — independent of everything else in the plan ("Depends: none, parallel-safe after T3"), and the last small task before T11 (the real-DS run).

## Deviation from the plan, logged as instructed

The plan proposed `TST1301` for the new "unknown `$type`" diagnostic. `TST1301` is already in use (`packages/core/src/index.js`: "requested target instance isn't in the config", an EMIT-stage error unrelated to DTCG structure) — a genuine numbering collision, not something to paper over by giving two different diagnostics the same code. Renumbered that one diagnostic to **`TST1306`**; the other three new codes (`TST1302`, `TST1304`, `TST1305`) are exactly as the plan specified (confirmed unused beforehand). `TST1303` was never a new code to begin with — the plan itself says "already `TST1105`; keep," so it's documented as a cross-reference, not implemented as a new check.

## What shipped

- **`packages/core/src/load.js`** — new `validateTokenTree(tree, file, diagnostics, seenNamespaces)`, run per file inside `loadTokenTrees()` before merging (so it sees the raw authored structure, not the flattened IR):
  - `TST1305` (warn) — a top-level group key isn't `option`/`semantic`/`component`.
  - `TST1302` (error) — a node declares `$type` locally but has neither `$value` nor child token keys (the clear "forgot to add `$value`" case — deliberately conservative: a node with an *inherited*, not locally-declared, type is not flagged, since group-level `$type` for inheritance purposes with genuinely no children yet is a legitimate empty placeholder, not a mistake).
  - `TST1306` (warn) — a resolved leaf's local `$type` isn't in the DTCG type set ir.md documents; the token is still carried through opaque (no crash — confirmed downstream: `normalize.js`'s `resolveEntry` only special-cases `type === 'color'`, so an unrecognized type just keeps the raw value as-is).
  - `TST1304` (info) — an `$extensions` namespace outside `transtyle.*` (the three reserved ones: `transtyle.modes`, `transtyle.role`, `transtyle.state-mechanism`). `seenNamespaces` is a `Set` created once per `loadTokenTrees()` call and threaded through every file's validation pass, so this fires once per compile, not once per file per the plan's "listed once per namespace."
- **`packages/cli/src/main.js`** — `--json` flag on `check` (parsed, documented in `--help`). Prints `{ diagnostics, targets: [{target, coverage}] }` to **stdout** via `console.log` — the existing human-readable diagnostics/coverage printing to stderr is untouched, so both streams are usable in the same invocation (`docs/specs/cli.md`'s existing "human logs → stderr; requested data → stdout" contract, now actually implemented for `check`).
- **`packages/core/test-fixtures/dtcg-validation/`** (new) — a minimal standalone project (config + two token files: one valid baseline authoring the required `primary.solid`, one `violations.tokens.json` deliberately triggering all five codes in the family: a `weird-tier` top-level group, an empty `$type`-only leaf, an unknown-`$type` leaf, an `$extensions` foreign namespace, and a dangling alias). Verified real Acme/Cathode compiles produce **zero** new diagnostics from this pass (both are clean DTCG already) before wiring the fixture into the test.
- **`scripts/check-cli.mjs`** — extended: runs `check --json` against the fixture, asserts exit 1 (the fixture's errors are real), asserts all five codes appear in the printed JSON, and asserts the JSON on stdout actually parses. (Needed to separate `stdout` from the combined `out` string in the test harness — the fixture's own dangling-alias message contains a literal `{...}` in its text, landing after the JSON block in the concatenated stdout+stderr string and breaking a naive "find the last `}`" extraction; fixed by parsing `stdout` alone, which this test harness already captured separately from stderr.)
- Docs: `docs/specs/validation-and-coverage.md` (new "DTCG structural validation (T10)" section, code table + remediation hints), `website/src/docs/diagnostics.md` (added the new codes to the reference table — and, while there, added `TST1111` and `TST1203`, two already-shipped codes from T7 that had never made it into this table), `docs/specs/cli.md` + `website/src/docs/cli.md` (status banner + new `--json` subsection), `website/src/docs/roadmap.md` (new Implemented row), `ROADMAP.md` (T10 checked off).

## Verification performed before committing

- Direct fixture run: `transtyle check --cwd packages/core/test-fixtures/dtcg-validation --json` — all five codes present, correct severities, JSON on stdout parses cleanly.
- `transtyle check --json` on both Acme and Cathode — `diagnostics: []` for both, confirming the new checks produce no false positives on real, clean token files.
- `npm run check:all` — clean, including the extended `check-cli.mjs`.
- `npm run site:build` — clean.

## Remaining plan work

Only **T11** (the real-DS run, Phase 1 exit) is left in `docs/plan/catalog-revision.md`.
