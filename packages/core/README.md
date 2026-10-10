<p align="center">
  <a href="https://transtyle.github.io/transtyle/"><img src="https://raw.githubusercontent.com/transtyle/transtyle/main/brand/transtyle-mark-on-dark-256.png" alt="Transtyle" width="88" height="88"></a>
</p>

# @transtyle/core

The compilation pipeline behind **[Transtyle](https://transtyle.github.io/transtyle/)** — a design system compiler: describe a design system once as W3C (DTCG) design tokens, compile native theme artifacts for every ecosystem.

> [!WARNING]
> **Alpha — experimental.** Breaking changes ship without a deprecation cycle: the token
> vocabulary, the generated output, the config format and the CLI surface can each change
> between alpha releases. Pin an exact version, and treat generated files as disposable
> output you regenerate — never as something to hand-edit and keep.
> ([why](https://github.com/transtyle/transtyle/blob/main/docs/adr/0010-pre-release-breaking-changes.md))

Most people never install this directly: `@transtyle/cli` depends on it. Install it when you
want to run the compiler from your own code — a build script, a CI check, a playground.

## Use

```js
import { compile, buildReport } from '@transtyle/core';

// Exporters are separate packages: tell core how to load one by name.
const loadExporter = async (name) => (await import(`@transtyle/exporter-${name}`)).default;
const result = await compile({ cwd: process.cwd(), emit: false, loadExporter });

// What `transtyle build` would write as the first target's report.json.
const { target, coverage, reads } = result.results[0];
const { diagnostics } = result;
const report = buildReport({
  target,
  coverage,
  reads,
  normalized: result.normalized,
  diagnostics: diagnostics.items,
  suppressed: diagnostics.suppressed,
});
console.log(report.coverage.counts);
```

## What it does

Six phases, in order: **load** (DTCG token files, or a Tokens Studio export read as it is) →
**normalize** (one canonical tree) →
**derive** (fill every slot you did not author, by versioned deterministic rules) →
**resolve** (per mode combination) → **emit** (hand the resolved IR to each exporter) →
**report**. Nothing is random and nothing depends on the clock or the filesystem order, so
two builds of the same input are byte-identical — there is a check in CI that proves it.

Also exported: `catalog()` (every catalog slot with its type, derivation rule and inputs, as
data — what `transtyle catalog --json` prints) and `isCatalogSlot(path)`, `adoption(normalized)` (the
project's own semantic tokens, which ones no catalog slot reads, with hints — the `adoption` field of
`transtyle check --json`), `diffResolved` and `contrastRegressions` (the
semantic diff), `explainToken` (the provenance walk behind `transtyle explain`, as a JSON
tree), `explainVariable` and `slotConsumers` (from a target variable to the slots it reads, and
back, over a compile's coverage rows), `coverageSlots` (what one coverage row reads), `consumption` (which targets read each catalog
slot, from the `reads` that `compile()` records on every target result and writes to its
`report.json`; what `transtyle check --matrix` prints), `buildReport` (the `report.json` object a
build writes per target, from a compile's result), `suggestBindings({ cwd })` (the binding
proposals behind `transtyle bind --suggest`, from a versioned name table, `SYNONYMS_VERSION`,
and color measurements), `loadConfigChain` and `mergeConfigChain` (a config's `extends` chain,
read and merged; `compile({ configFile })` selects the config), `customTokens` (a design system's own `semantic.*`
vocabulary outside the catalog, which core accounts for on every target after emit), `Diagnostics`,
and the colour module — `parseColor` (any CSS color syntax a stylesheet holds, or a DTCG color object, to OKLCH), `formatColor`, `formatHex`, `formatHslTriplet`, `contrastRatio`,
`mix` — which is OKLCH-native and has no dependencies. `makeUnits(config)` builds the `ctx.units` helpers
(`toPx`, `toRem`, `remBase`) exporters get, from the config's `units.remBase`.
`checkPluginCompat(manifest)` and `PLUGIN_API_VERSIONS` are the exporter compatibility check
`compile()` runs when your `loadExporter` returns `{ plugin, manifest, package }` instead of the
bare plugin: the manifest's `irSpec` must be this core's IR spec, its `pluginApi` a semver range
accepting one of `PLUGIN_API_VERSIONS` (`TST1309` otherwise).

**Zero external dependencies**, deliberately. The one opt-in exception: `check.contrast.standard: "apca"` loads the
`apca-w3` package, an optional peer dependency you install yourself (`npm install --save-dev apca-w3`), because
APCA's licence doesn't allow a copy of it here. `loadContrast(config, cwd)` gives the same contrast measure
`compile()` uses, and `compile()` returns it as `contrast` for `contrastRegressions`.

## Documentation

- [How Transtyle works](https://transtyle.github.io/transtyle/docs/how-transtyle-works/)
- [Internals](https://transtyle.github.io/transtyle/docs/internals/)
- [Derivation](https://transtyle.github.io/transtyle/docs/derivation/)

## License

MIT — part of the [Transtyle](https://github.com/transtyle/transtyle) monorepo.
