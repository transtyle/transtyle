# Validation, diagnostics, and coverage

<!-- measured: codes = 42 -->

> **Status (re-verified 2026-10-09):** the diagnostics collector, the 42 shipped
> `TST` codes, DTCG structural validation, contrast checking, the coverage
> classes, `report.json`, `check --json`, per-diagnostic source locations and
> config suppressions (`check.suppress`) are **implemented**. Still specced:
> tier-violation checks,
> exporter-declared mode support, the emitted-file drift manifest, and
> `--frozen`. Each is marked below rather than left for the reader to guess —
> this page had drifted into describing all of it in the present tense.

Translation between design ecosystems is lossy. Competitors hide this; we instrument it. The coverage report is the product's trust mechanism and its clearest differentiator ([prior-art.md](../prior-art.md)).

## Diagnostics

Every pipeline stage emits diagnostics into one collector; a run reports everything at once (no fix-one-rerun loops). Each diagnostic carries a stable code (`TST####`), a severity (`error | warning | info`), a message, and an optional `hint` rendered on its own `↳` line — message says what is wrong, hint says what to change, and they stay separate fields in `report.json` so editors and CI annotations can place them independently. Identical diagnostics de-duplicate on (severity, code, message): derivation runs once per mode combination, and a single authoring mistake used to be reported once per combination.

### Source locations

A diagnostic about something authored in a token file carries `path` (the dotted token or group path), `file` (relative to the project, as printed), and `line` and `column` (both 1-based; the column is the key's opening quote). LOAD scans each token file's text once (`packages/core/src/locate.js`, zero-dependency) and keeps the position of every key; NORMALIZE records which file each key came from while it merges the base layers, last layer winning, so a token defined twice (`TST1103`) points at the later definition. A mode-scoped layer's diagnostics (`TST1107`, `TST1108`) point into that layer's own file. In the terminal the location sits after the code, `✖ TST1105 tokens/brand.tokens.json:17:9 Dangling alias …`. `check --json` and `report.json` carry the four fields as they are.

What each code points at: `TST1002` the file and, when the parser reports a position, the line it stopped at; `TST1103`, `TST1105`, `TST1106`, `TST1107`, `TST1108`, `TST1302`, `TST1304`, `TST1305`, `TST1306`, `TST1307` and `TST1104` (its first token) the offending token or group; `TST1202`, `TST1203`, `TST1204`, `TST1205`, `TST1201`, `TST2101`, `TST2102` and `TST2103` carry a `path` too, and a location only when that path is authored (a role's `.solid`, a bound token). A value that is derived (an `on-solid` contrast ratio, a missing `primary.solid`) is in no file, so it has no `file`/`line`/`column` and prints as it always did. Config-level codes (`TST1010`, `TST1011`, `TST1301`) have no location: the config file is not scanned yet.

### Suppressions

`check.suppress` silences a known warning or info, and says why:

```jsonc
"check": {
  "suppress": [
    { "code": "TST1305", "path": "scratch", "reason": "scratch is a throwaway group for a spike" },
    { "code": "TST1204", "path": "component.*", "reason": "components follow their semantic token's dark value" },
  ],
}
```

- `code` and `reason` are required; `reason` must not be empty or blank (both fail config load as `TST1010`, with the path to the entry, as does an unknown key). `path` is optional: an exact token path, or a prefix ending in `.*` (`component.button.*`, matching below the group, not the group itself). No other wildcard.
- A diagnostic matches when the codes are equal and, if the entry has a `path`, the diagnostic's `path` matches. An entry without `path` matches every diagnostic with that code, which is how to silence one that is not about a token.
- **Silence, never downgrade.** A matching warning or info leaves `diagnostics`, so it is neither printed nor counted by `check.failOn`. It moves to `suppressed` in `report.json` and in `check --json` (always present, `[]` when nothing was suppressed), each with its `reason`, `path` and location, so a suppression stays auditable. The terminal prints one line, `ℹ N diagnostics suppressed by check.suppress (listed in report.json)`.
- **Errors are never suppressible**: an error means the output would be wrong. An entry that matches only an error leaves it in place.
- An entry that silenced nothing (stale, mistyped, or matching only an error) raises `TST1012`, an `info`, not a warning: building a single target runs fewer checks, so an entry for another target's diagnostic would otherwise fail a `failOn: "warning"` project.
- Suppression runs once, after every stage that produces diagnostics and before the targets are emitted, so every target's report agrees.

Severity policy: **errors** = output would be wrong, and nothing is emitted (unresolvable alias `TST1105`, cycle `TST1104`, unparseable token file `TST1002`, schema violation `TST1010`/`TST1011`, a polarity axis that would drop dark mode `TST1112`). **warnings** = output is produced but deserves attention (contrast below the standard `TST2101`, colors that can't be told apart `TST2102`/`TST2103`, a token defined twice across base layers `TST1103` (silent in a layer marked `override`, which warns `TST1116` instead when it defines a token nothing earlier defines), a mode value overridden by a later layer `TST1108`). **info** = notable but fine (a foreign `$extensions` namespace carried through `TST1304`, a role whose dark value is the light one carried over `TST1204`). Which severities fail a build is `check.failOn`, not the severity itself: a warning stops CI when you ask it to. A known one can be silenced with a reason: see [Suppressions](#suppressions).

## Built-in checks (Phase 1)

Implemented:

- **Schema validity** — the config against `config/v0` (`TST1010`), each target's `options` against its exporter's own schema (`TST1011`), and every token file's DTCG structure (the table below).
- **Reference integrity** — dangling aliases (`TST1105`) and cycles with the full chain printed once per loop (`TST1104`).
- **Mode integrity** — a mode-scoped layer naming an undeclared mode (`TST1109`) or more than one dimension (`TST1110`), a mode value for a token with no default (`TST1107`), a later layer overriding a mode value (`TST1108`), and `color-scheme` declared after another dimension, which is an error because dark mode would otherwise silently never reach an exporter (`TST1112`).
- **Tier violations** — a `semantic.*` token whose alias points straight at a `component.*` token is an error (`TST1113`): the tiers layer option → semantic → component, so a semantic token reading from the component tier inverts the layering. Only the direct edge is reported, once per token, naming both tokens; `component → semantic` and `component → component` are the legitimate layering and stay silent. The exporter half is a contract, not a user diagnostic (a user cannot fix an exporter's binding): no exporter may return a coverage row whose slot is under `option.*` (binding to `component.*` is legitimate), enforced for all exporters by `check:plugins` and `check:minimal-ds`. The coarser "top-level group isn't a tier name" check is `TST1305`.
- **Option hygiene** — `option.*` tokens that no alias resolves to (`TST1114`) and option tokens of one type that resolve to the same value (`TST1115`; colors compared in OKLCH within a tolerance far below a visible difference, hue ignored near zero chroma, other types exactly). Both are `info` by default, once per build, with the count and first paths in the message and the full lists (`paths`) on the diagnostic in `check --json`; `check.hygiene.unusedOption` / `duplicateOption` set `info` | `warning` | `off`.
- **Binding rules** — a malformed `bindings` rule (`TST1117`), a `required` rule whose target token is missing (`TST1118`), and two rules binding one slot, where the earlier wins (`TST1119`, `info`). See [configuration.md](configuration.md#binding-rules).
- **Contrast** — every `<role>.on-solid`/`<role>.on-tint` pairing and `text`/`elevation.N.surface` pairing measured per mode against `check.contrast.standard` (`TST2101`; WCAG 2.1 AA default, AAA available). Accessibility is a compiler check, not a plugin.
- **Authored values a target turns into something else** (issue #93) — an authored colour that a slot reaches and that lies outside sRGB (`TST1120`, info, once per source token: the targets that write hex or HSL clamp it, and Bootstrap and Storybook say so nowhere else; the predicate is `formatHex`'s own `clamped`, so the diagnostic and the `approximated` rows agree, and derived colours or option tokens no slot reads are out of scope); a partially authored ordered scale (`space`, `type.size`, `size.control`, `border-width`, `breakpoint`, `duration`) that the catalog defaults make wrong, either a default out of order with an authored neighbour or a group whose authored tokens are all outside the catalog's rung names (`TST1121`, warning, once per scale, compared in px with rem at `units.remBase` or in ms; one tuned rung that stays in order is silent, an empty group is already `TST1302`); and a shadcn rung that its own offsets bring to 0 or below while `radius.md` is above 0 (`TST2104`, info, from the exporter, below).
- **Distinguishability** — the eight `palette.categorical.N` entries (`TST2102`) and the `solid` colors of `success`/`warning`/`danger`/`info` plus every role archetyped `status` (`TST2103`) must be pairwise at least ΔE<sub>OK</sub> 0.05 apart in each mode, measured as the Euclidean OKLab distance on the resolved values, with no gamut mapping, so the result is deterministic and target-independent. 0.05 is 2.5x CSS Color 4's just-noticeable difference (0.02) and stays under the derived palette's closest pair (0.082), so a derived design system never warns; the constant (`DISTINGUISHABLE_DELTA_E`) is recorded here and in the [worklog](../worklog/2026-10-09-bl-18-distinguishability.md), not configurable. Colors under it are grouped into clusters (connected components) and each cluster is one warning per mode. A pair whose two slots alias the same token (following the chain) is skipped: sharing a token is intent. `transtyle diff` does not report distinguishability regressions yet.

Specced, not implemented:

- **Mode matrix completeness per exporter-declared mode support** — exporters do not declare mode support yet; a target that cannot express a dimension reports `dropped(mode:<dim>)` per value instead. Tracked as [issue #9](https://github.com/transtyle/transtyle/issues/9).
- **Drift detection** — emitted-file hashes against a `transtyle-manifest.json`, so a hand-edited generated file warns. No manifest is written today; the generated files carry a "regenerate, don't edit" header and nothing enforces it. Tracked as [issue #10](https://github.com/transtyle/transtyle/issues/10).
- **Lockfile freshness** (`--frozen`, [issue #1](https://github.com/transtyle/transtyle/issues/1)), and **APCA** as a contrast standard ([BL-15](../backlog.md#bl-15)).

## DTCG structural validation (T10)

Runs per token file at LOAD, before merging (`packages/core/src/load.js`) — catches authoring mistakes the tree-walk that builds the IR would otherwise silently swallow (an empty group, an unrecognized `$type`, a stray `$extensions` namespace) rather than surfacing them only as a missing slot three stages later.

| Code      | Severity | Meaning                                                                                                                                                                            | Remediation                                                                                                                               |
| --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `TST1302` | error    | A node declares `$type` but has neither `$value` nor child tokens                                                                                                                  | Add the missing `$value`, or remove the node if it was a leftover placeholder                                                             |
| `TST1303` | —        | Alias to a non-existent path — this _is_ `TST1105` (dangling alias), not a new code; listed here because it's part of the same authoring-mistake family                            | Fix the `{...}` reference to point at a real token path                                                                                   |
| `TST1304` | info     | An `$extensions` namespace this IR doesn't reserve (i.e. not `transtyle.*`)                                                                                                        | Nothing to fix — it's carried through untouched for the tool that owns it; informational only                                             |
| `TST1305` | warning  | A top-level group isn't `option`, `semantic`, or `component`                                                                                                                       | Move the tokens under the right tier, or confirm the typo in the group name                                                               |
| `TST1306` | warning  | A token's `$value` has an unrecognized `$type`                                                                                                                                     | Use one of the DTCG types the IR understands, or accept that this token is carried opaque (no parsing, no derivation eligibility)         |
| `TST1113` | error    | A `semantic.*` token aliases a `component.*` token — the alias points the wrong way up the tiers (direct edge only; a chain reports the token that points into the component tier) | Alias the component token's own source instead, or move the token under `component.`                                                      |
| `TST1307` | error    | A token file looks like Style Dictionary v3 (`value`/`type` without `$`), so it has no DTCG tokens                                                                                 | Convert it to DTCG (`$value`/`$type`/`$description`, references without `.value`); `transtyle migrate --from style-dictionary` is planned |

## Per-target mode subsets

`targets.<t>.modes` (see [configuration.md](configuration.md#per-target-mode-subsets)) is checked once per requested target, at EMIT, before anything is written. All of a target's problems are reported, and one bad subset stops the build for every target.

| Code      | Severity | Meaning                                                                                                        | Remediation                                                                                      |
| --------- | -------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `TST1308` | error    | A target's `modes` names a dimension or a value the project's `modes` doesn't declare, or leaves out a default | Use declared names; include the dimension's default value, or change `modes.<dimension>.default` |

`TST1109` already means "a mode-scoped _layer_ targets an undeclared mode" (a token-file mistake), so the target-level mistake has its own code. A dimension narrowed to a single value by a target is a deliberate exclusion, not a loss: it produces no `dropped` coverage row, even for an exporter that never expresses that dimension. Dimensions the subset doesn't name keep all their values (and keep their `dropped` row where the exporter can't express them).

`transtyle check --json` prints the full diagnostics array (plus the `suppressed` list and per-target coverage) to stdout as one JSON object — human logs still go to stderr, so both can run in the same invocation without interleaving (`docs/specs/cli.md` "Behavioral contracts").

## Exporter diagnostics

Some findings only an exporter can make, because they depend on its target's own conventions: shadcn subtracts 4px and 2px from `--radius` for its `sm` and `md` rungs, so a 2px `radius.md` ships square `rounded-sm` and `rounded-md` (`TST2104`). An exporter returns them next to `files` and `coverage` as `diagnostics: [{ severity, code, message, hint? }]` ([plugins.md](../architecture/plugins.md#the-exporter-interface-v0-as-implemented)). Core accepts `info` and `warning` only (an exporter cannot stop a build from inside `emit`), prefixes the message with the target instance name, sets `target`, and adds them to the run's diagnostics; a malformed list is a contract violation and becomes `TST3001`. `plugin-kit` checks the same shape (`emit-diagnostics-valid`).

## Exporter failures (`TST3xxx`)

A throw inside an exporter is a diagnostic, not a crash of the whole run (`packages/core/src/index.js`, around `exporter.emit`). Only the exporter's own code is wrapped: a file-system error while writing the output still fails loudly, because it is not an exporter bug.

| Code      | Severity | Meaning                                                                                                              | Remediation                                                                                                    |
| --------- | -------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `TST3001` | error    | An exporter threw in `emit`; the message names the target instance. Its `report.json` lists no files and no coverage | An exporter bug: re-run with `TRANSTYLE_DEBUG=1` for the stack. The other targets are built as usual           |
| `TST3002` | error    | An exporter could not be loaded; the message names the target instance                                               | Install the package in the project, or fix the target's `exporter` field. The other targets are built as usual |

These errors do not stop later targets (the "never emit with errors present" guard counts pipeline errors only), and they go through `check.failOn` and exit 1 like every other error. The stack is attached to the diagnostic (`stack`, also in `report.json`) only with `TRANSTYLE_DEBUG=1`, so default output stays deterministic. `--verbose` ([issue #5](https://github.com/transtyle/transtyle/issues/5)) will replace the variable.

## Coverage report

Produced per target in RESOLVE ([pipeline.md](../architecture/pipeline.md#4-resolve)). Every binding between an IR value and target output is classified:

| Class          | Meaning                                                        | Example                                                                                 |
| -------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `native`       | Target has a first-class slot; value passes through losslessly | `semantic.color.primary.solid → $primary`                                               |
| `derived`      | Value was synthesized by derivation, then mapped natively      | derived `secondary → $secondary`                                                        |
| `approximated` | Mapped, but meaning changed en route                           | cubic-bezier easing flattened to a keyword the target supports; oklch → hex gamut clamp |
| `dropped`      | IR expresses it; this target cannot; omitted with reason       | `density` mode for a target with no density concept                                     |
| `unsupported`  | Target has a themable slot the IR doesn't cover yet            | an exotic framework variable left at framework default                                  |

`dropped` and `unsupported` are opposite directions of mismatch — reporting both keeps us honest about the IR's limits, not just the targets'. `unsupported` entries across exporters are the data that drives semantic-catalog growth: a concept that two independent exporters report `unsupported`, for architectural rather than nominal reasons, is a catalog candidate (the rule in the language reference's "How the language grows"). The count is necessary, not sufficient — a proposal still decides. This sentence used to say "3+ exporters" while the language reference and [proposal 0003](../proposals/0003-component-catalog-generalization.md) said two; two is the rule.

### Catalog signals

A row can say what it is missing in an optional **`meaning`** field: a key of dot-separated kebab-case segments (`icon.size`, `type.display-ladder`), the same key on every exporter that reports the same concept. Rows are grouped across exporters by that key, never by their note text — two exporters' prose never matches, and a grouping no exporter declared is a claim nobody made. Every key is registered, with a status, in [`docs/findings/catalog-meanings.json`](../findings/catalog-meanings.json):

| Status            | Meaning                                                                     |
| ----------------- | --------------------------------------------------------------------------- |
| `open`            | a candidate waiting for evidence from another exporter                      |
| `watch`           | deferred by a proposal, reopens on a named trigger (BL-19, proposal 0004)   |
| `disagreement`    | both sides have the concept and model it incompatibly — not a growth signal |
| `rejected`        | tested by a proposal and turned down                                        |
| `target-specific` | the target's own surface, not design-token semantics                        |
| `promoted`        | now a catalog slot; kept so the history stays readable                      |

`disagreement` answers the open question the [2026-07-27 worklog](../worklog/2026-07-27-coverage-bar-asymmetry.md) left: `unsupported` keeps covering both a gap and a disagreement, and the status tells them apart without a sixth coverage class.

`npm run gen:catalog-signals` compiles every example against every official exporter and writes [`docs/findings/catalog-signals.md`](../findings/catalog-signals.md): totals per exporter, every meaning with the exporters and rows behind it and the proposal that settled it, PrimeNG's slots that wait on an undriven Aura path, the rows with no meaning yet, and the catalog slots targets `dropped`. PrimeNG reports one row per family, so for it the page reads the slots one by one (the exporter's own `classifySurface()` over its emitted preset) and reconciles the total with the report; Mantine reports one summary row per family and a named row per entry it leaves on Mantine's default, and the page counts the named rows. `check:catalog-signals`, part of `check:all`, fails when the page is stale, when a row declares a key the registry doesn't list, and when the registry keeps a key nothing reports (other than `promoted`).

**Absence is not coverage.** A row classed `native` or `derived` names a slot that has a value. When a design system leaves a slot out, the exporter skips it, or reports it `dropped` or `unsupported`; it never claims it, and never crashes for want of it. A mode dimension the target cannot express is one `dropped` row named `(mode:<dimension>)`, never silence. The plugin kit checks both on every plugin (`coverage-honest`, `mode-dimensions-accounted`).

### Structured fields: `slots` and `via`

A row is `{ variable, slot, class, provenance?, note? }`, and `slot` is a label for humans: an IR path, or prose (`via driven roots`, `semantic.duration.fast + easing.standard`, `semantic.color.primary.*`). Tools that need the mapping itself (`transtyle explain --target` / `--variable`, [cli.md](cli.md#explain---target---variable--from-a-slot-to-target-variables-and-back); the slot matrix of `check --matrix`) read two optional fields instead ([issue #98](https://github.com/transtyle/transtyle/issues/98)):

- `slots: string[]`: the fully qualified IR paths the variable reads, when `slot` doesn't say it exactly. Bootstrap's `$form-label-font-size` is labelled `semantic.type.role.label.md (fontSize)` and carries `slots: ["semantic.type.role.label.md"]`; `$btn-transition` carries both its duration and its easing. Absent, a `slot` that is an IR path counts as `[slot]`, so an exporter whose labels are exact paths needs nothing. An empty `slots` reads nothing.
- `via: string[]`: the target variables this one follows, each the `variable` of another row of the same target. Bootstrap fills it for its chained rows (the `$` references Bootstrap's own `!default` chain records in `surface-inventory.json`: `$form-select-border-radius` → `$input-border-radius`) and for the ones aliasing a global custom property (the Sass variable `_root.scss` sets it from: `var(--bs-border-radius-sm)` → `$border-radius-sm`).

`@transtyle/core` exports the rule as `coverageSlots(row, normalized)`. `@transtyle/plugin-kit`'s conformance suite checks that both fields are string arrays when present and that every `slots` entry is a path of the IR the exporter was given (`coverage-slots-exist`). One variable per row reads best: PrimeNG's brace rows (`components.button.root.{borderRadius,paddingX,paddingY}`) were split into one row per preset path for this, and so was its `semantic.typography.*` row.

### Coverage percentages are not comparable across targets

A target's coverage percentage measures how much of _its_ surface we drive. It does **not** rank targets against each other, because the ceiling is set by the target's theming architecture, not by how much work we've done. Re-measured 2026-08-29 on the two component-heavy targets, against `examples/acme` (every count below is re-derived on each `check:doc-numbers` run, and the parts are guarded rather than the totals — a sum can be right while both its halves are wrong):

<!-- measured: bootstrap.surface.total = 952 -->
<!-- measured: bootstrap.surface.component = 657 -->
<!-- measured: primeng.surface.total = 2759 -->
<!-- measured: primeng.surface.families = 98 -->
<!-- measured: acme.bootstrap.native = 59 -->
<!-- measured: acme.bootstrap.derived = 489 -->
<!-- measured: acme.bootstrap.approximated = 39 -->
<!-- measured: acme.bootstrap.dropped = 71 -->
<!-- measured: acme.bootstrap.unsupported = 56 -->
<!-- measured: acme.primeng.driven = 89 -->
<!-- measured: acme.primeng.inherited = 1566 -->
<!-- measured: acme.primeng.base = 1104 -->

|                                          | Bootstrap                                                               | PrimeNG                                                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Surface                                  | 952 variables (657 component-scoped)                                    | 2759 slots across 98 families                                                                       |
| Driven                                   | 59 native + 489 derived = 548 of 714 rows (77%), plus 39 `approximated` | 89 driven + 1566 inherited = 1655 (60%), 1104 left on Aura's default                                |
| Undriven                                 | 71 `dropped` + 56 `unsupported`                                         | the family rows in `report.json`; slot by slot in [catalog signals](../findings/catalog-signals.md) |
| Reachable without new catalog vocabulary | **~0**                                                                  | **221**                                                                                             |

The 60% is the target with room to grow; the 77% is the one that has converged. The reason is architectural:

<!-- measured: acme.bootstrap.undriven = 127 -->

- **PrimeNG resolves `{token.path}` references at runtime**, so driving one semantic path cascades to every component slot pointing at it — a multiplier. Driving `formField.paddingX` alone reaches Button plus every form component. 1,552 of its covered slots are `inherited` this way, and 221 more sit behind 100 semantic paths this exporter drives only partially (`form.field.*` 125, `navigation.item.*` 65, `list.*` 21, `overlay.*` 10) — all expressible with catalog vocabulary that already ships.
- **Bootstrap's Sass path binds per variable**, with no multiplier. Its 127 undriven variables were measured group by group and every group fails for a structural reason, not for missing work. The five largest account for 98 of them: structural/behavioral options like cursor and order (29), Bootstrap's own shade/tint derivation knobs (18, made redundant by our own state derivation), `null` cascade no-ops on non-inherited properties (18), bespoke geometry already tested and rejected by [proposal 0004](../proposals/0004-component-geometry.md) (17), and embedded SVG assets (16). The remaining 29 sit in eleven smaller groups, the largest being per-component opacity values with no shared meaning (12) and concepts both reference targets model incompatibly (4).

Two consequences for reading the bar:

1. **Track a target against its own history, not against another target.** A drop in Bootstrap's number is a regression; Bootstrap being lower than a hypothetical 95% target says nothing.
2. **A ref-resolving target rewards semantic-tier work; a per-variable target rewards exporter-tier work.** The same engineering hour buys very different coverage depending on which side of that line the target sits.

A third consequence for the catalog: on a per-variable target, an `unsupported` slot is evidence the IR lacks a concept. On a ref-resolving target it may only mean the exporter hasn't driven a path it could — check which before reading it as catalog-growth signal.

<!-- measured: mantine.surface.total = 203 -->
<!-- measured: acme.mantine.set = 106 -->
<!-- measured: acme.mantine.follow = 66 -->
<!-- measured: acme.mantine.default = 31 -->

Mantine is a third shape, measured since 2026-10-09: a small theme object from which Mantine computes most of its CSS variables at runtime, so its 203-entry inventory holds both the theme keys and the variables, and an entry either is **set** by the exporter, **follows** from what is set, or keeps **Mantine's default** with a reason. On Acme that is 106 set, 66 follow and 31 on Mantine's default. Its follow count plays the role of PrimeNG's `inherited` (a multiplier, smaller because Mantine's surface is), and most of its defaults are behaviour switches with no design value rather than catalog gaps, so it reads against neither of the other two. The rule and its numbers per example are in the [Mantine exporter spec](exporters/mantine.md#measured-against-mantines-whole-surface).

## Report format

`report.json` (schema-versioned) per build, plus terminal rendering:

What the CLI actually prints, from `npx transtyle build shadcn --cwd examples/acme`:

```
shadcn  42% native · 53% derived · 3% approximated · 3% dropped
  ↳ dist/shadcn/globals.transtyle.css
  ↳ dist/shadcn/usage.md
  ↳ dist/shadcn/report.json

✔ build complete
```

Diagnostics print above that block, each as two lines — `✖`/`⚠`/`ℹ` with the code and message, then the hint on a `↳` line. (This section previously showed a mockup with a progress bar, a version-suffixed target name, and invented percentages; the renderer never produced any of it. The transcript above is checked against a real compile by `check:doc-numbers`.)

The JSON form is consumed by CI (thresholds via `check.failOn: error | warning | approximation`), `transtyle diff` (coverage regressions between DS versions are surfaced), and — planned — the preview site's badge rendering.

## Testing strategy (project-level)

- **Conformance fixtures:** `@transtyle/plugin-kit` ships nine small design systems and runs every plugin against each, asserting the contract rather than a snapshot: the `emit(ir, ctx)` shape, determinism across two runs, IR immutability, honest coverage classes, no JavaScript value leaked into a file, no coverage claim for a slot without a value, a `density` mode either emitted or reported `dropped`, DTCG structured values indistinguishable from their CSS strings, and a valid options schema. Beside the canonical one (14 authored tokens, light and dark), they are the shapes that broke exporters before the kit could see them ([#96](https://github.com/transtyle/transtyle/issues/96)): one token, three tokens, two mode dimensions, a single mode, an authored component tier, a custom archetyped role, authored composites, DTCG object forms. `check:plugins` gates all ten official exporters plus an inline third-party plugin with them, with a broken plugin per check proving it fails, and third parties run the same function. They stay small; catalog completeness is `check:grid`'s job (every slot `catalog()` says a rule fills, in both modes, and no slot filled outside it), and the engine-level assertions over sparse systems (every mode shape, `autoDark`, TST1112, malformed composites) live in `check:minimal-ds`.
- **Determinism gate:** `check:determinism` builds all four examples twice and byte-compares the trees; CI runs it on every push. Determinism is what makes every other check here meaningful — a coverage number is only evidence if the same input yields it again.
- **Ground-truth tests per exporter:** generated output is loaded by the _actual target toolchain_ — snapshot tests catch our regressions; ground-truth tests catch the framework moving underneath us. What exists: 40 demo projects (10 targets × 4 examples) build in CI on every push, which compiles the emitted Sass through Bootstrap's own build, type-checks the PrimeNG preset against PrimeNG's `DesignTokens` types the Mantine theme against Mantine's own types and the Chakra config against Chakra's, and boots the themed Storybook. What is still manual: looking at the result. Nothing yet asserts on a headless render — a demo that builds green can still be visually wrong, which is why the T11 review checklist is a human pass. Tracked as [issue #12](https://github.com/transtyle/transtyle/issues/12).
- **Property tests on derivation:** e.g. contrast-pick over a plain candidate list (`<role>.on-solid`) returns the max-contrast candidate; the `<role>.on-tint` on-brand walk returns an AA-passing candidate whenever one exists inside the lightness clamp and is monotone in its step count (this line previously overclaimed "always max-contrast", contradicting the rule's on-brand intent — caught and fixed by [exercise F19](../exercises/phase0-shadcn-rerun.md)); scales are monotonic; OKLCH ramps stay in gamut after clamping.
