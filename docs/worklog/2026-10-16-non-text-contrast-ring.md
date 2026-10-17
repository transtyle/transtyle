# Non-text contrast: the focus ring

Follow-up of [#92](https://github.com/transtyle/transtyle/issues/92) (APCA as a contrast standard). `check` measured text pairs only; the spec said non-text pairs were not checked.

## What was built

- `contrast.js`: a `non-text` use. WCAG 2.1 gives 3:1 at both levels (SC 1.4.11 has no AAA level); `APCA_LEVELS['non-text']` is Lc 30.
- `checks.js`: `ring` on `elevation.{0,1}.surface` joins `CONTRAST_PAIRS`, so `check`, the other-combos pass and `diff` all see it. A `contrast: more` combination raises the ring to 4.5:1 or Lc 45 instead of the text levels.
- GOV.UK suppresses `TST2101` on `ring` with a reason: its yellow focus (1.3:1 on white) is paired with a dark outline.
- Spec "Contrast", the `TST2101` row of the diagnostics page, ADR-0013, a changeset, tests in `scripts/check-cli.mjs`.

## Decisions

- Borders are not checked (Julien, 2026-10-10: ring only). They measure 1.2:1 to 1.6:1 on all four examples and the catalog default.
- Lc 30 for APCA, the Silver minimum for spot-readable elements; Lc 45 is the fluent level and is used for `contrast: more`.

## Found on the way

A derived ring follows the brand, so `init --brand #ffe066`, `#0a0a0a` and `#00ff00` now warn on the ring. That is the check working; the neutral-ladder test in `check-cli.mjs` excludes the ring because it is not a neutral pair.
