---
title: "Weird things & diagnostics"
description: "Every diagnostic code, and every surprising-but-correct behavior, explained."
order: 11
---

# Weird things & diagnostics

Transtyle prefers surprising you *loudly* over failing silently. This page collects every diagnostic code and every behavior that looks wrong until you know why it's right.

## Diagnostic code reference

| Code | Severity | Meaning | What to do |
|---|---|---|---|
| `TST1001` | warning | A token glob matched no files | Check the path in `tokens` |
| `TST1002` | error | A token file failed to parse | Fix the JSON; the message includes the parser error |
| `TST1103` | warning | Token defined more than once across base layers (last wins) | Make the override explicit or remove the duplicate |
| `TST1104` | error | Alias cycle (full chain printed) | Break the cycle |
| `TST1105` | error | Dangling alias — `{path}` points at nothing | Fix the path; check tier prefixes (`option.` vs `semantic.`) |
| `TST1106` | error | Unparseable value (e.g. unsupported color syntax) | Use `oklch()` or `#hex` |
| `TST1107` | warning | Mode-scoped file provides a value for a token with no default value | Add the token to a base layer first |
| `TST1108` | warning | A mode value was overridden by a later layer | Confirm the layer order is intentional |
| `TST1109` | error | Mode-scoped layer targets a mode not declared in `modes` | Declare it, or fix the typo |
| `TST1110` | error | Mode-scoped layer targets more than one dimension | One dimension per layer |
| `TST1201` | error | `semantic.color.primary.base` missing | Author your brand color — it's the one non-negotiable input |
| `TST1202` | error | A token in `derivation.require` was derived, not authored | Author it, or remove it from `require` |
| `TST1301` | error | Requested target instance isn't in the config | Check instance names in `targets` |
| `TST2101` | warning | Contrast below the configured standard (measured ratio printed) | Adjust the color, or accept the warning knowingly |

## Surprising-but-correct behaviors

### My dark-native system comes out light-first

`modes.default` declares *your* native mode; it does not reorder exporter output. Exporters bind mode **names** — shadcn's structure is always `:root` = light, `.dark` = dark, because that's what shadcn consumers expect. Your native look is intact, just addressed by name. (Found by the Cathode example, now an IR rule.)

### My brand color is identical in dark mode

`autoDark` is off by default and you didn't author a dark value — so the value falls back, by design. Transtyle does not invent brand decisions. Author `primary.base` a dark-mode value (one line) or opt into `autoDark: true` and audit the result in the report.

### `--secondary` doesn't look like my secondary color

shadcn's `--secondary` is a *subtle surface* (think: secondary button background), not a brand-secondary. The exporter maps it from `neutral.subtle` on purpose. Your brand `secondary` role exists in the IR and will map to targets that actually mean "second brand color".

### A variable is classified `approximated`

Three current causes: `--input` (shadcn distinguishes input borders; the catalog doesn't yet); OKLCH → HSL gamut clamping in the tailwind-v3 era (the note says so); unit conversions. Approximation is information, not an error — the report exists so you can decide if you care.

### Negative radius in the output

With `radius.md: 0rem`, shadcn's own convention produces `calc(var(--radius) - 4px)` = negative. Browsers treat negative radii as invalid and render 0 — the correct result. A future check may flag it explicitly.

### Contrast warning on a color I like

`TST2101` prints the measured WCAG ratio. It's a warning, not a veto — set `check.failOn` to decide whether your CI cares. But the number is real; the near-miss cases (4.4:1) are exactly the ones eyes don't catch.

### Two builds, byte-identical output

Not a bug — a promise. No timestamps, no randomness, sorted file loading, fixed number formatting. If two builds of the same inputs ever differ, that *is* a bug; please report it.
