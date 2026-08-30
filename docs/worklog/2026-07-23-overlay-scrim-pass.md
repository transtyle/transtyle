# The overlay/scrim pass — and a corrupted source file found on the way

Follow-up to [AL2](2026-07-23-al2.md)'s one deferred-not-rejected candidate ([proposal 0003](../proposals/0003-component-catalog-generalization.md)).

## The finding: no catalog addition — the premise was wrong

AL2 deferred overlay veil strength with the note "`semantic.color.scrim` already carries the color, and the missing piece is an alpha convention." Checking it properly disproved that: `scrim` resolves to `{ l: 0.1, c: 0, h: 0, alpha: 0.5 }` — **the alpha was in the IR all along**, and authorable.

What actually differed was projection, not vocabulary. Bootstrap splits a veil into two variables (`$modal-backdrop-bg` + `$modal-backdrop-opacity`, verified in `_modal.scss`), so from the Bootstrap side the alpha _looked_ absent; PrimeNG consumes one rgba value and was already driven. The fix was one new recipe form in the Bootstrap descriptors — `part: 'opaque' | 'alpha'` — plus dropping a PrimeNG hardcode.

**Verified end to end:** authoring `scrim: oklch(0.2 0.05 260 / 0.82)` produces Bootstrap `$modal-backdrop-bg: #08152c` + `$modal-backdrop-opacity: 0.82` and PrimeNG `mask.background: oklch(0.2 0.05 260 / 0.82)` — one token, each target's native shape. `$offcanvas-backdrop-*` chains from modal's and follows for free.

Also removed: PrimeNG's hardcoded `mask.transitionDuration: '0.3s'`, now `duration.normal` (`approximated`, nearest rung). Bootstrap's veil fade is its **global** `$transition-fade`, out-of-inventory foundation — nominal correspondence only, so nothing was promoted for timing either.

`$modal-backdrop-bg`/`-opacity` were classified `unsupported` with the note "scrim covers the color, not the alpha". That note was wrong and is now deleted rather than softened.

## Unrelated defect found and fixed: NUL bytes in a committed source file

While grepping `components.js`, `grep` reported **"Binary file matches"**. The file contained two NUL bytes, sitting inside a template literal (`` `${sel}\0${cssVar}` `` — a Set key). JavaScript accepts that silently, which is why `check:all` had passed 59/59 across three commits and the emitted output was always correct.

The damage was to reviewability, not behavior: git had committed the file as `Bin 0 -> 10525 bytes` in [159d5a5](https://github.com/transtyle/transtyle/commit/159d5a5) — **AL1.4's principal new file landed with no reviewable diff**, and would have broken `git blame`, PR review, and GitHub rendering from then on.

Both bytes replaced with the spaces they should have been; the file is UTF-8 text again and diffs normally. Scanned every source file touched during AL1/AL2 — no others affected. Root cause is most likely a shell heredoc mangling during the AL1.4 write; the lasting mitigation is that this file is now plain text under version control, so any recurrence shows up immediately as a binary diff in review.

## Checks

`check:all` green (59). Bootstrap gains two driven variables (previously `unsupported`); PrimeNG's preset changes only `mask.transitionDuration` (`0.3s` → `250ms`). No other emitted output moved.
