---
title: 'Weird things & diagnostics'
description: 'Every diagnostic code, and every surprising-but-correct behavior, explained.'
order: 11
---

# Weird things & diagnostics

Transtyle prefers surprising you _loudly_ over failing silently. This page collects every diagnostic code and every behavior that looks wrong until you know why it's right.

## Diagnostic code reference

| Code      | Severity | Meaning                                                                                                                                           | What to do                                                                                                                    |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `TST1001` | warning  | A token glob matched no files                                                                                                                     | Check the path in `tokens`                                                                                                    |
| `TST1002` | error    | A token file failed to parse                                                                                                                      | Fix the JSON; the message includes the parser error                                                                           |
| `TST1010` | error    | `transtyle.config.json` doesn't match its schema — unknown key, wrong type, missing `tokens`, or a bad `check.failOn`/`contrast.standard` value   | Fix the flagged path; a typo'd key is an error, not silently ignored                                                          |
| `TST1011` | error    | A target's `options` are invalid for its exporter — unknown option, wrong type, or a value outside the allowed set (e.g. an unknown shadcn `era`) | Check the exporter's page for its options; an exporter that takes none rejects any                                            |
| `TST1103` | warning  | Token defined more than once across base layers (last wins)                                                                                       | Make the override explicit or remove the duplicate                                                                            |
| `TST1104` | error    | Alias cycle (full chain printed)                                                                                                                  | Break the cycle                                                                                                               |
| `TST1105` | error    | Dangling alias — `{path}` points at nothing                                                                                                       | Fix the path; check tier prefixes (`option.` vs `semantic.`)                                                                  |
| `TST1106` | error    | Unparseable value (e.g. unsupported color syntax)                                                                                                 | Colors accept `oklch()`, `#hex`, `rgb()`, `hsl()`, and CSS named colors; `lab()`/`lch()`/`hwb()`/`color()` are not yet parsed |
| `TST1107` | warning  | Mode-scoped file provides a value for a token with no default value                                                                               | Add the token to a base layer first                                                                                           |
| `TST1108` | warning  | A mode value was overridden by a later layer                                                                                                      | Confirm the layer order is intentional                                                                                        |
| `TST1109` | error    | Mode-scoped layer targets a mode not declared in `modes`                                                                                          | Declare it, or fix the typo                                                                                                   |
| `TST1110` | error    | Mode-scoped layer targets more than one dimension                                                                                                 | One dimension per layer                                                                                                       |
| `TST1111` | warning  | `$extensions.transtyle.role.archetype` isn't `brand`/`status`/`neutral`                                                                           | The role still joins the grid regardless — fix the value, or ignore if intentional                                            |
| `TST1201` | error    | `semantic.color.primary.solid` missing                                                                                                            | Author your brand color — it's the one non-negotiable input                                                                   |
| `TST1202` | error    | A token in `derivation.require` was derived, not authored                                                                                         | Author it, or remove it from `require`                                                                                        |
| `TST1203` | warning  | A role archetype has no authored `.solid` in a given mode                                                                                         | Author `<name>.solid` for that mode, or drop the archetype extension                                                          |
| `TST1301` | error    | Requested target instance isn't in the config                                                                                                     | Check instance names in `targets`                                                                                             |
| `TST1302` | error    | A token declares `$type` but has neither `$value` nor child tokens                                                                                | Add the missing `$value`, or remove the leftover node                                                                         |
| `TST1304` | info     | An `$extensions` namespace outside `transtyle.*`                                                                                                  | Nothing to fix — carried through untouched, informational only                                                                |
| `TST1305` | warning  | A top-level group isn't `option`/`semantic`/`component`                                                                                           | Move the tokens under the right tier, or fix the typo                                                                         |
| `TST1306` | warning  | A token's `$value` has an unrecognized `$type`                                                                                                    | Use a DTCG type the IR understands, or accept it's carried opaque                                                             |
| `TST2101` | warning  | Contrast below the configured standard (measured ratio printed)                                                                                   | Adjust the color, or accept the warning knowingly                                                                             |

`TST1303` isn't a separate code — an alias to a non-existent path is `TST1105` above; it's part of the same "authoring mistake" family the DTCG validation pass (T10) documents together.

Aliasing a **derived** slot is fine and won't raise `TST1105`: `component.button.radius: "{semantic.radius.full}"` works even though nothing authors `radius.full`, because such aliases resolve right after derivation. `TST1105` means the target never exists — at any stage.

## Surprising-but-correct behaviors

### My dark-native system comes out light-first

`modes.default` declares _your_ native mode; it does not reorder exporter output. Exporters bind mode **names** — shadcn's structure is always `:root` = light, `.dark` = dark, because that's what shadcn consumers expect. Your native look is intact, just addressed by name. (Found by the Cathode example, now an IR rule.)

### My brand color is identical in dark mode

`autoDark` is off by default and you didn't author a dark value — so the value falls back, by design. Transtyle does not invent brand decisions. Author `primary.solid` a dark-mode value (one line) or opt into `autoDark: true` and audit the result in the report.

### `--secondary` doesn't look like my secondary color

shadcn's `--secondary` is a _subtle surface_ (think: secondary button background), not a brand-secondary. The exporter maps it from `neutral.tint` on purpose. Your brand `secondary` role exists in the IR and will map to targets that actually mean "second brand color".

### A variable is classified `approximated`

Three current causes: `--input` (shadcn distinguishes input borders; the catalog doesn't yet); OKLCH → HSL gamut clamping in the tailwind-v3 era (the note says so); unit conversions. Approximation is information, not an error — the report exists so you can decide if you care.

### Negative radius in the output

With `radius.md: 0rem`, shadcn's own convention produces `calc(var(--radius) - 4px)` = negative. Browsers treat negative radii as invalid and render 0 — the correct result. A future check may flag it explicitly.

### Contrast warning on a color I like

`TST2101` prints the measured WCAG ratio. It's a warning, not a veto — set `check.failOn` to decide whether your CI cares. But the number is real; the near-miss cases (4.4:1) are exactly the ones eyes don't catch.

### Two builds, byte-identical output

Not a bug — a promise. No timestamps, no randomness, sorted file loading, fixed number formatting. If two builds of the same inputs ever differ, that _is_ a bug; please report it.
