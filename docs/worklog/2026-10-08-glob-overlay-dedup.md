# A glob and an overlay in one folder loaded the overlay twice

Found while checking the [adoption guide](../../website/src/docs/adopt-existing.md)'s
step 2 against the compiler (#121). The guide's config is the one `transtyle init`
leads to: the scaffold globs `tokens/*.tokens.json`, and
[authoring-tokens.md](../../website/src/docs/authoring-tokens.md) then recommends
a dark overlay file next to the base one.

```json
"tokens": [
  "tokens/*.tokens.json",
  { "files": "tokens/dark.tokens.json", "mode": { "color-scheme": "dark" } }
]
```

## The defect

`loadTokenTrees()` walked the entries in order and pushed one tree per matched
file, tagged with the entry's mode scope. Nothing compared files across entries,
so `dark.tokens.json` was pushed twice: once unscoped (the glob), once scoped to
`dark` (the overlay). NORMALIZE merges every unscoped tree as a base layer, so
the overlay's copy landed on top of `base.tokens.json`: one `TST1103` per token
it holds, and its dark values became the light ones. On the guide's example that
put light `text.base` on `elevation.1.surface` at 1.1:1. Swapping the two
entries changed nothing: the glob still matched the file.

None of the four examples saw it, because each lists its base files one by one,
and no checker compiled a glob next to an overlay.

## The fix

The loader now makes two passes: it expands every mode-scoped entry first and
collects the files they match, then loads the entries in order, with the plain
globs skipping those files. The rule is order-independent on purpose, and
[ADR-0009's amendment](../adr/0009-token-layering.md#amendment-2026-10-08-an-overlay-claims-its-file)
says why: whether a file is an overlay is settled by the entry that names it with
a `mode`, not by where that entry sits. No new diagnostic, since loading the
file once, as the overlay, is what the config means. `TST1001` counts what a
glob matched on disk before the skip, so a glob whose only matches are overlays
does not warn.

## Measured

New fixture `packages/core/test-fixtures/glob-plus-overlay/` (base and dark
files in one `tokens/` folder), with the glob first, and `overlay-first/` reading
the same files with the overlay listed first. `check:cli` grades both through
`check --json` and `explain`:

| Order         | Before                                 | After                     |
| ------------- | -------------------------------------- | ------------------------- |
| glob first    | 4× `TST1103`, light `text.base` = dark | no diagnostic, light kept |
| overlay first | 4× `TST1103`, light `text.base` = dark | no diagnostic, light kept |

Light `text.base` reads `oklch(0.2 0.01 255)` after the fix and read the
overlay's `oklch(0.95 0.005 255)` before it; dark reads the overlay's in both.
Verified red by restoring the old loader (five failures: `TST1103` and the light
value in both orders, plus the `TST1001` case) and by counting `TST1001` after
the skip instead of before it (the `TST1001` case alone fails). No example's
output moves: they never combined a glob with an overlay.

The adoption guide's step 2 had been changed to list the base file one by one,
with a note warning against the glob (#123), while the loader was fixed. With
the fix in, its glob form is correct again: the example is back to
`tokens/*.tokens.json` and the note is gone.
