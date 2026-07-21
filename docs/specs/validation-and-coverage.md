# Validation, diagnostics, and coverage

Translation between design ecosystems is lossy. Competitors hide this; we instrument it. The coverage report is the product's trust mechanism and its clearest differentiator ([prior-art.md](../prior-art.md)).

## Diagnostics

Every pipeline stage emits diagnostics into one collector; a run reports everything at once (no fix-one-rerun loops). Each diagnostic: stable code (`TST####`), severity (`error | warning | info`), source location (file:line via LOAD source maps), and a remediation hint. Codes are documented and individually suppressible in config (suppressions require a `reason` string — auditable, not silent).

Severity policy: **errors** = output would be wrong (unresolvable alias, cycle, schema violation, unsupported target version). **warnings** = output is produced but deserves attention (contrast failure, drifted generated file, unit approximation, duplicate token). **info** = notable but fine (derivation filled a slot, defaulted catalog value).

## Built-in checks (Phase 1)

- Schema validity (manifest + token files, exporter options).
- Reference integrity: dangling aliases, cycles (full chain printed), tier violations (semantic token aliasing a component token, exporter binding below the semantic tier).
- Mode matrix completeness per exporter-declared mode support.
- **Contrast:** every `<role>.on-solid`/`<role>.on-tint` pairing and `text`/`elevation.N.surface` pairing measured per mode against `check.contrast.standard` (WCAG 2.1 AA default; APCA planned). Accessibility is a compiler check, not a plugin.
- Drift: emitted-file hashes vs `transtyle-manifest.json` — hand-edited generated files produce warnings naming the file.
- Lockfile freshness (`--frozen`).

## DTCG structural validation (T10)

Runs per token file at LOAD, before merging (`packages/core/src/load.js`) — catches authoring mistakes the tree-walk that builds the IR would otherwise silently swallow (an empty group, an unrecognized `$type`, a stray `$extensions` namespace) rather than surfacing them only as a missing slot three stages later.

| Code | Severity | Meaning | Remediation |
|---|---|---|---|
| `TST1302` | error | A node declares `$type` but has neither `$value` nor child tokens | Add the missing `$value`, or remove the node if it was a leftover placeholder |
| `TST1303` | — | Alias to a non-existent path — this *is* `TST1105` (dangling alias), not a new code; listed here because it's part of the same authoring-mistake family | Fix the `{...}` reference to point at a real token path |
| `TST1304` | info | An `$extensions` namespace this IR doesn't reserve (i.e. not `transtyle.*`) | Nothing to fix — it's carried through untouched for the tool that owns it; informational only |
| `TST1305` | warning | A top-level group isn't `option`, `semantic`, or `component` | Move the tokens under the right tier, or confirm the typo in the group name |
| `TST1306` | warning | A token's `$value` has an unrecognized `$type` | Use one of the DTCG types the IR understands, or accept that this token is carried opaque (no parsing, no derivation eligibility) |

`transtyle check --json` prints the full diagnostics array (plus per-target coverage) to stdout as one JSON object — human logs still go to stderr, so both can run in the same invocation without interleaving (`docs/specs/cli.md` "Behavioral contracts").

## Coverage report

Produced per target in RESOLVE ([pipeline.md](../architecture/pipeline.md#4-resolve)). Every binding between an IR value and target output is classified:

| Class | Meaning | Example |
|---|---|---|
| `native` | Target has a first-class slot; value passes through losslessly | `semantic.color.primary.solid → $primary` |
| `derived` | Value was synthesized by derivation, then mapped natively | derived `secondary → $secondary` |
| `approximated` | Mapped, but meaning changed en route | cubic-bezier easing flattened to a keyword the target supports; oklch → hex gamut clamp |
| `dropped` | IR expresses it; this target cannot; omitted with reason | `density` mode for a target with no density concept |
| `unsupported` | Target has a themable slot the IR doesn't cover yet | an exotic framework variable left at framework default |

`dropped` and `unsupported` are opposite directions of mismatch — reporting both keeps us honest about the IR's limits, not just the targets'. `unsupported` entries across exporters are the data that drives semantic-catalog growth (an `unsupported` slot appearing in 3+ exporters is a catalog candidate).

## Report format

`report.json` (schema-versioned) per build, plus terminal rendering:

```
bootstrap@5.3  ██████████████░░  87% native · 9% derived · 3% approximated · 1% dropped
  ⚠ TST2101 contrast 3.8:1 < 4.5:1  warning.on-solid (dark)   tokens/brand.tokens.json:14
  ℹ dropped: density mode (bootstrap has no density concept)
```

The JSON form is consumed by CI (thresholds via `check.failOn: approximation`), `transtyle diff` (coverage regressions between DS versions are surfaced), and the Phase 2 preview site (badge rendering).

## Testing strategy (project-level)

- **Conformance fixtures:** one canonical fixture DS exercises every catalog slot, every mode combination, and every derivation rule; all exporters snapshot against it (the plugin-kit runs the same fixtures for third parties).
- **Determinism gate:** CI builds everything twice and byte-compares.
- **Ground-truth tests per exporter:** generated output is loaded by the *actual target toolchain* (compile the Sass with Bootstrap, apply the ECharts theme in headless render, boot the themed Storybook) — snapshot tests catch our regressions; ground-truth tests catch the framework moving underneath us.
- **Property tests on derivation:** e.g. contrast-pick over a plain candidate list (`<role>.on-solid`) returns the max-contrast candidate; the `<role>.on-tint` on-brand walk returns an AA-passing candidate whenever one exists inside the lightness clamp and is monotone in its step count (this line previously overclaimed "always max-contrast", contradicting the rule's on-brand intent — caught and fixed by [exercise F19](../exercises/phase0-shadcn-rerun.md)); scales are monotonic; OKLCH ramps stay in gamut after clamping.
