# Worklog — dead-vocabulary guard hardening

**Why:** pre-revision catalog names (`primary.base`, `background`, `surface.base`) slipped past `check-sync`'s dead-vocab guard twice this session. Root cause: every existing pattern matched only the **dotted** spelling (`semantic.color.primary.base`), but the vocabulary reappears as **nested JSON keys** in token files and docs code-fences (`"primary": { "base": … }`), which no pattern covered.

**Changes to `scripts/check-sync.mjs`:**

1. Added a nested-JSON companion for every old shape:
   - `"(primary|…|neutral)": { … "(base|hover|active|subtle|contrast)": }` — a color role directly holding an old grid cell. The role set is explicit precisely so `text.base` and `link.{base,hover,visited}` (current vocab) can never match.
   - `"(background|surface|overlay|text-muted)": { … "base": }` — old surface/content slots. **Requires the `.base` child**, which is the discriminator: the new elevation leaf (`"surface": { "$value" }`) and a design system's own custom token (`carbon.background`, holds `$value` directly) don't match.
2. Extended the scan scope to `website/src/pages/*.astro` (the homepage references catalog vocab in its token showcase; it was previously unscanned).
3. **Guard-the-guard self-test:** `DEAD_VOCAB_MUST_MATCH` / `DEAD_VOCAB_MUST_NOT` fixtures run before the file scan. Weaken a pattern → the MUST_MATCH set fails; introduce a false positive → the MUST_NOT set fails. Verified by simulation that reverting to the pre-session dotted-only patterns makes the self-test fail.

**Bugs the new patterns caught on the current tree (fixed):** `website/src/docs/authoring-tokens.md` still taught `"primary": { "base" }` and `"surface": { "base" }` in two code-fences — corrected to `primary.solid` and `elevation.1.surface`.

**False positive correctly avoided:** `examples/carbon/tokens/semantic.tokens.json` has a legitimate custom `semantic.color.carbon.background` (IBM Carbon's own `$background`); the `.base`-child discriminator leaves it alone. Confirmed clean.

**Verified:** check:sync (incl. self-test), check:docs, full check:all (35 ✔), and site build all green.
