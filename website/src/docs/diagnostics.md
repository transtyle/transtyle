---
title: 'Weird things & diagnostics'
description: 'Every diagnostic code, and every surprising-but-correct behavior, explained.'
order: 11
---

# Weird things & diagnostics

Transtyle prefers surprising you _loudly_ over failing silently. This page collects every diagnostic code and every behavior that looks wrong until you know why it's right.

## How a diagnostic is printed

Two lines, never one:

```
✖ TST1301 Target "bootstrp" is not configured in transtyle.config.json
  ↳ Did you mean "bootstrap"? Configured targets: bootstrap, primeng
```

The first line says **what is wrong**; the `↳` hint says **what to change**. They're separate fields (`message` and `hint`) in `report.json` too, so editors and CI annotations can place them independently. The "What to do" column below is the same advice — the point of the hint is that you get it at the moment of failure without coming here.

Two behaviors worth knowing:

- **Identical diagnostics are printed once.** Derivation runs once per mode combination, so a single authoring mistake used to be reported once per combination — a two-token alias cycle printed twelve lines. Anything genuinely per-mode still says which mode in its message.
- **Consequences are suppressed in favor of causes.** A dangling alias makes `semantic.color.primary.solid` unresolvable, but you're shown the dangling alias (`TST1105`), not the missing token (`TST1201`) — fixing the symptom would not have helped. Likewise an alias cycle reports `TST1104` alone, not a "dangling alias" for each token in the loop. And a role whose `.solid` failed to resolve (`TST1105`, `TST1104`, `TST1106`) draws no dark-mode carry-over note (`TST1204`): there is no light-mode colour to carry over. A role bound to a slot derived too late draws `TST1205` only when its alias resolves in the end; a dangling or looping one reports `TST1105` or `TST1104` alone.

## Diagnostic code reference

| Code      | Severity | Meaning                                                                                                                                                                                                             | What to do                                                                                                                                                                                                                                  |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TST1001` | warning  | A token glob matched no files                                                                                                                                                                                       | Check the path in `tokens`                                                                                                                                                                                                                  |
| `TST1002` | error    | A token file failed to parse                                                                                                                                                                                        | Fix the JSON; the message includes the parser error                                                                                                                                                                                         |
| `TST1010` | error    | `transtyle.config.json` doesn't match its schema — unknown key, wrong type, missing `tokens`, or a bad `check.failOn`/`contrast.standard` value                                                                     | Fix the flagged path; a typo'd key is an error, not silently ignored, and near-miss keys get a "did you mean" suggestion                                                                                                                    |
| `TST1011` | error    | A target's `options` are invalid for its exporter — unknown option, wrong type, or a value outside the allowed set (e.g. an unknown shadcn `era`)                                                                   | Check the exporter's page for its options; an exporter that takes none rejects any                                                                                                                                                          |
| `TST1103` | warning  | Token defined more than once across base layers (last wins)                                                                                                                                                         | Make the override explicit or remove the duplicate                                                                                                                                                                                          |
| `TST1104` | error    | Alias cycle (full chain printed)                                                                                                                                                                                    | Break the cycle                                                                                                                                                                                                                             |
| `TST1105` | error    | Dangling alias — `{path}` points at nothing (inside a composite, the message names the member's path)                                                                                                               | Fix the path; check tier prefixes (`option.` vs `semantic.`)                                                                                                                                                                                |
| `TST1106` | error    | Unparseable value (e.g. unsupported color syntax, a DTCG dimension object with no unit), or a malformed composite member, named by its own path (`semantic.color.elevation.1.shadow.color`)                         | Colors: `oklch()`, `#hex`, `rgb()`, `hsl()`, named (`lab()`/`lch()`/`hwb()`/`color()` not yet). DTCG objects need a number `value` and a `px`/`rem` (`ms`/`s`) unit; the hint lists every accepted form                                     |
| `TST1107` | warning  | Mode-scoped file provides a value for a token with no default value                                                                                                                                                 | Add the token to a base layer first                                                                                                                                                                                                         |
| `TST1108` | warning  | A mode value was overridden by a later layer                                                                                                                                                                        | Confirm the layer order is intentional                                                                                                                                                                                                      |
| `TST1109` | error    | Mode-scoped layer targets a mode not declared in `modes`                                                                                                                                                            | Declare it, or fix the typo                                                                                                                                                                                                                 |
| `TST1110` | error    | Mode-scoped layer targets more than one dimension                                                                                                                                                                   | One dimension per layer                                                                                                                                                                                                                     |
| `TST1111` | warning  | `$extensions.transtyle.role.archetype` isn't `brand`/`status`/`neutral`                                                                                                                                             | The role still joins the grid regardless — fix the value, or ignore if intentional                                                                                                                                                          |
| `TST1112` | error    | `color-scheme` is declared (with more than one value) but isn't the first mode dimension                                                                                                                            | List it first. Only the first dimension carries light/dark polarity, so a later `color-scheme` would ship a dark block filled with light values — the build stops rather than emit it                                                       |
| `TST1201` | error    | `semantic.color.primary.solid` missing — the one token derivation cannot invent                                                                                                                                     | Author your brand color at that exact path; a bare `semantic.color.primary` is a different slot. Silent when an upstream error already explains the absence                                                                                 |
| `TST1202` | error    | A token in `derivation.require` was derived, not authored                                                                                                                                                           | Author it, or remove it from `require`                                                                                                                                                                                                      |
| `TST1203` | warning  | A role archetype has no authored `.solid` in a given mode                                                                                                                                                           | Author `<name>.solid` for that mode, or drop the archetype extension                                                                                                                                                                        |
| `TST1204` | info     | An authored or bound role's `.solid` resolves to the _same colour_ in a non-default `color-scheme` value as in the default one — the whole derived grid carries over unchanged                                      | Author `<role>.solid` for that scheme value if it should differ. Default behavior, not a mistake. With `derivation.autoDark: true`, the carry-over is at least classified `derived` in coverage — it still doesn't compute a distinct color |
| `TST1205` | warning  | A role's `.solid` (or `text.base`) aliases a slot derived after it is read: the alias resolves, but the role's grid (or the content ladder under `text.base`) is not derived                                        | Alias an authored token or another role's `.solid` or grid cell instead, or author the slot as a colour. A role bound to `ring`, `link.*`, `palette.categorical.*` or the content ladder hits this                                          |
| `TST1301` | error    | Requested target instance isn't in the config                                                                                                                                                                       | The hint distinguishes a typo (suggests the near name) from a real exporter you simply haven't configured yet                                                                                                                               |
| `TST1302` | error    | A token declares `$type` but has neither `$value` nor child tokens                                                                                                                                                  | Add the missing `$value`, or remove the leftover node                                                                                                                                                                                       |
| `TST1304` | info     | An `$extensions` namespace outside `transtyle.*`                                                                                                                                                                    | Nothing to fix — carried through untouched, informational only                                                                                                                                                                              |
| `TST1305` | warning  | A top-level group isn't `option`/`semantic`/`component`                                                                                                                                                             | Move the tokens under the right tier, or fix the typo                                                                                                                                                                                       |
| `TST1306` | warning  | A token's `$value` has an unrecognized `$type`                                                                                                                                                                      | Use a DTCG type the IR understands, or accept it's carried opaque                                                                                                                                                                           |
| `TST2101` | warning  | Contrast below the configured standard (measured ratio printed)                                                                                                                                                     | Adjust the color, or accept the warning knowingly. When a color carried over from the default mode unchanged, the hint says so — that's usually the real cause of a dark-mode warning                                                       |
| `TST2102` | warning  | Two colors of `palette.categorical.*` are closer than ΔE<sub>OK</sub> 0.05 in a mode (clusters named once, closest distance printed)                                                                                | Author one of the entries as `semantic.palette.categorical.N`. Today's derived palette never triggers it (its closest pair is 0.082); an authored palette can                                                                               |
| `TST2103` | warning  | Two or more of `success`/`warning`/`danger`/`info` (and roles archetyped `status`) have `.solid` colors closer than ΔE<sub>OK</sub> 0.05 in a mode, or identical (one warning per cluster)                          | Fix the source colors: when they are authored or bound that way Transtyle carries them through as written. Two roles bound to the very same token are intentional and skipped                                                               |
| `TST3001` | error    | An exporter threw while emitting. The message names the target instance and the exporter's own error; the other targets are still built, and the crashed one gets a `report.json` with no files and this diagnostic | This is an exporter bug, not a design-system mistake. Re-run with `TRANSTYLE_DEBUG=1` to print the stack, then report it or fix your plugin. Exits 1, like any error                                                                        |
| `TST3002` | error    | An exporter could not be loaded (package not installed, or the `exporter` field is wrong). The message names the target instance; the other targets are still built                                                 | Install the package in this project (`npm install <package>`), or fix the target's `exporter` field                                                                                                                                         |

`TST1303` isn't a separate code — an alias to a non-existent path is `TST1105` above; it's part of the same "authoring mistake" family the DTCG validation pass (T10) documents together.

Aliasing a **derived** slot is fine and won't raise `TST1105`: `component.button.radius: "{semantic.radius.full}"` works even though nothing authors `radius.full`, because such aliases resolve right after derivation. `TST1105` means the target never exists — at any stage.

## Surprising-but-correct behaviors

### A three-token design system is valid, and a target variable just goes missing

Nothing obliges you to author a radius scale, a font stack, or a border color. If you don't, the slots that derive from them don't exist — and an exporter that has a binding for them emits **nothing** rather than a broken declaration. You'll see the variable in `report.json` classed `dropped`, with a note naming the slot to author if you want it driven:

```
$btn-border-radius  dropped  nothing to bind: this design system has no
                             component.button.radius. The binding exists, its
                             source does not — author that slot (or the scale it
                             derives from) and this variable starts being driven.
```

The target's own default then applies, which is what "we have nothing to say about this" should mean. A Bootstrap theme map is the one place an entry can't simply go missing, because the exporter replaces Bootstrap's whole map: the entry keeps Bootstrap's own variable (`"dark": $dark-text-emphasis`) and is reported as `$theme-colors-text.dark`, `dropped`. `check:minimal-ds` compiles a one-token design system (only `primary.solid`) and a three-token one against every exporter on each CI run, asserting none of them crashes and none writes a JavaScript value into a stylesheet.

### My dark-native system comes out light-first

`modes.default` declares _your_ native mode; it does not reorder exporter output. Exporters bind mode **names** — shadcn's structure is always `:root` = light, `.dark` = dark, because that's what shadcn consumers expect. Your native look is intact, just addressed by name. (Found by the Cathode example, now an IR rule.)

### My brand color is identical in dark mode

You didn't author a dark value, so it falls back to the light one — by design, and surfaced as `TST1204` (`info`) so it's visible in the report rather than only here. The test is the resolved colour, not the token text: if you [bound the role](/docs/adopt-existing/) to your own vocabulary and _that_ token carries a dark value, nothing carried over and no note is raised. Transtyle does not invent brand decisions: author `primary.solid` a dark-mode value (one line), or set `derivation.autoDark: true` so the carry-over is at least classified `derived` in coverage instead of `authored`. Either way the color itself stays the light one — `autoDark` doesn't yet compute a distinct dark color, that transform is a still-open question ([roadmap](/docs/roadmap/#specced-not-yet-implemented)).

### `--secondary` doesn't look like my secondary color

shadcn's `--secondary` is a _subtle surface_ (think: secondary button background), not a brand-secondary. The exporter maps it from `neutral.tint` on purpose. Your brand `secondary` role exists in the IR and will map to targets that actually mean "second brand color".

### A variable is classified `approximated`

Three current causes: `--input` (shadcn distinguishes input borders; the catalog doesn't yet); OKLCH → HSL gamut clamping in the tailwind-v3 era (the note says so); unit conversions. Approximation is information, not an error — the report exists so you can decide if you care.

### Negative radius in the output

With `radius.md: 0rem`, shadcn's own convention produces `calc(var(--radius) - 4px)` = negative. Browsers treat negative radii as invalid and render 0 — the correct result. A future check may flag it explicitly.

### Contrast warning on a color I like

`TST2101` prints the measured WCAG ratio. It's a warning, not a veto — set `check.failOn` to decide whether your CI cares. But the number is real; the near-miss cases (4.4:1) are exactly the ones eyes don't catch.

### Two colors that can't be told apart

`TST2102` and `TST2103` measure the distance in OKLab (ΔE<sub>OK</sub>, the Euclidean distance CSS Color 4 uses for gamut mapping, where 0.02 is the just-noticeable difference). They warn under **0.05**, and they report a _cluster_ once per mode: four status roles that all resolve to the same color give one warning naming the four, not six pairs. Two slots bound to one token (`warning` and a custom `crt-amber` role both bound to `{semantic.color.crt.amber}`) are a stated intent, so that pair is skipped; equal colors in _different_ tokens are the accident the check exists for. Both are warnings, so `check.failOn` decides whether CI cares. The derived palette and derived status roles never trip them (closest pairs: 0.082 and 0.12); they guard authored values.

### Two builds, byte-identical output

Not a bug — a promise. No timestamps, no randomness, sorted file loading, fixed number formatting. If two builds of the same inputs ever differ, that _is_ a bug; please report it.
