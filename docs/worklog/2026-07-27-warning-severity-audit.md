# Auditing the other warnings for TST1112's failure shape

TST1112 got promoted to an error because its condition is a specific, narrow
thing: the compiled output is not just incomplete, it **actively contains
plausible-looking wrong values** — a full dark stylesheet that parses fine and
looks like a real dark theme, except every value in it is light. That's a
sharper bar than "this diagnostic is silent" or "this diagnostic points at a
real authoring mistake." Read literally: does the described condition
guarantee an exporter emits a value where the _shape_ is right (a variable
exists, a selector block exists) but the _value_ is wrong, with no other
signal telling the consumer that?

Every other `warning`-severity code, checked against that bar:

| Code      | Condition                                                | Does the compiled output become _wrong_ (not just incomplete)?                                                                                                                                                                                                                                                                                                                                                     |
| --------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TST1001` | Token glob matched no files                              | No — the affected tokens are absent; nothing downstream claims a value for them. Often legitimate (a mode file that doesn't exist yet).                                                                                                                                                                                                                                                                            |
| `TST1103` | Token defined twice, last wins                           | No — deterministic, documented, frequently the intended way to layer overrides.                                                                                                                                                                                                                                                                                                                                    |
| `TST1107` | Mode value for an unauthored token, skipped              | No — the token doesn't exist at all in _any_ mode, so nothing downstream expects a value from it.                                                                                                                                                                                                                                                                                                                  |
| `TST1108` | Mode value overridden by a later layer                   | No — same as 1103, deterministic and often intentional.                                                                                                                                                                                                                                                                                                                                                            |
| `TST1111` | Role archetype isn't a known value                       | No — the message says it outright: "the role still joins the grid regardless." Purely a metadata nit.                                                                                                                                                                                                                                                                                                              |
| `TST1203` | Custom role archetype has no authored `.solid` in a mode | No — traced the code (`derive.js:107-114`): when this fires, the role's grid is `continue`d, i.e. **not derived at all** for that mode. The role is absent from that mode's map, not present-with-wrong-values. Looked like a candidate on a shallow read; isn't one once you check what "grid not derived" actually does.                                                                                         |
| `TST1305` | Top-level group isn't `option`/`semantic`/`component`    | No — traced `collectTokens()`: it walks every key with no tier filter, so the mistyped group's tokens are collected at the wrong path, present in the raw map, just permanently unreachable by any alias or exporter binding (which all start with `option.`/`semantic.`/`component.`). Orphaned, not incorrect — nothing reads a value from that path and gets the wrong answer, because nothing reads it at all. |
| `TST1306` | Unrecognized `$type`                                     | No — explicitly "carried through opaque," untouched by derivation.                                                                                                                                                                                                                                                                                                                                                 |
| `TST2101` | Contrast below the configured standard                   | No — a real, measured number, but a design _judgment call_ (documented explicitly as "not a veto"), not an engine defect with one correct answer.                                                                                                                                                                                                                                                                  |

**Conclusion: no other warning matches TST1112's shape. No further promotions.**

## The one adjacent thing worth flagging (not a warning-severity issue)

While tracing `TST1203`, the actual "brand color identical in dark mode" fallback
turned out to live somewhere with **no diagnostic at all**: `derive.js:41-42`
reads `primary.solid` straight from the per-mode map, and NORMALIZE's
per-dimension resolution (`normalize.js`) already silently substitutes the
default-mode value when a non-default mode has no authored override — before
DERIVE ever runs. This is documented as intended in `diagnostics.md`'s
"surprising but correct" section ("My brand color is identical in dark mode")
and is explicitly the common, legitimate state for early-stage design systems
(exactly the shape `check:minimal-ds`'s own three-token floor exercises) — so
it should stay silent by default. It's a different class of gap from anything
in the table above: not a mis-severitized warning, but a documented behavior
with zero machine-checkable diagnostic backing the doc's claim. Flagged
separately rather than acted on here, since "should this get an info-level
diagnostic" is a product decision, not a severity fix.
