---
'@transtyle/core': minor
'@transtyle/cli': minor
---

`transtyle diff` reports a changed `$description` or `$deprecated`, and the slots that newly reach a deprecated token.

Two new lists follow the per-mode slots: `Metadata` (a token's own description or deprecation changed, in every tier) and `Deprecations` (a catalog slot now reaches, or no longer reaches, a deprecated token, with its reason). Both make `diff` exit 1, since the emitted comments change, and `--json` gains `metadata` and `deprecations` without touching existing keys. A target whose files changed only in comments prints `comments only` instead of `no output change`, with `commentLines` in `--json`. `reachedDeprecations()` in `@transtyle/core` is the shared walk behind `TST1122` and `diff`.
