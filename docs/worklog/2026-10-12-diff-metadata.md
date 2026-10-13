# diff: report description and deprecation changes (#192)

`transtyle diff` compared values and provenance only. Deprecating a token or rewriting a description printed "No semantic changes... compiled themes are identical" and exited 0: the changed comments are skipped by `lineChanges()` and `report.json` and `usage.md` are not part of the impact.

## What shipped

- `diffResolved()` returns `metadata` (a token's own `$description` or `$deprecated` changed, any tier, default mode compared) and `deprecations` (a catalog slot's reached deprecated tokens changed, `reached` or `cleared`). `hasChanges` counts both; `changedSlots` stays values only.
- `reachedDeprecations()` in `metadata.js` is the one walk for `TST1122` (`reportDeprecatedReach()` now uses it) and `diff`, over every mode combo, once per (slot, token). The `hasDeprecated()` shortcut is kept, so a system that deprecates nothing pays no walk (#97).
- `printDiff()` prints `Metadata:` and `Deprecations:` blocks between the slots and the impact; `--json` gains `metadata`, `deprecations` and `commentLines` per target, additively.
- A file that changed only in comments shows as `comments only` in the impact.
- Docs: `docs/specs/diff.md`, `docs/specs/validation-and-coverage.md`, `website/src/docs/cli.md`, `packages/core/README.md`. Changeset: minor for core and cli.

## Decisions

- **Exit 1 for anything listed**, a description-only change included: the emitted comments move, so "identical" would be false, and exit 1 keeps its one meaning. CI that only watches values reads `semantic` from `--json`.
- **Reach is compared over every mode**, not the default mode alone, and names no mode, like `TST1122`.
- A slot's own deprecation stays in `Metadata`, not in `Deprecations`.
- No new diagnostic code.
