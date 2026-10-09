# Plugin architecture

> **Status: reconciled with the implementation (P1, 2026-07-22).** [ADR-0011](../adr/0011-v0-freeze-readiness.md) found this document described a richer contract than any exporter implemented. Rather than build toward prose no one used, the spec was **dropped to what all eight shipped exporters actually do**, and that contract is now executable: `@transtyle/plugin-kit` enforces it, and every official exporter passes it in CI. Formal _freezing_ of the plugin API still waits for first publication (R4, currently parked) — but the spec below is no longer aspirational.

Plugins are the product's growth mechanism. The design optimizes for one metric: **a competent frontend engineer ships a working third-party exporter in a weekend, without reading core source.** ([ADR-0004](../adr/0004-plugin-packaging.md))

## Packaging

A plugin is an npm package. Official: `@transtyle/exporter-bootstrap`; community: anything, discoverable via the `transtyle-exporter` keyword and (later) registry metadata. No custom file archive format, no config-folder copying: npm already solves versioning, distribution, deprecation, and locking — a bespoke mechanism would re-solve all four, badly.

```
exporter-bootstrap/
  package.json            # declares: transtyle plugin manifest (see below)
  src/index.js            # default export: the plugin object
  src/descriptors.js      # this exporter's own mapping data, applied by its own emit
  surface-inventory.json  # the target's themable surface, for coverage measurement
```

`package.json` carries the manifest — static metadata readable _without executing the plugin_ (needed for `transtyle add`, registry tooling, and trust review):

```jsonc
// exporter-bootstrap's real manifest, verbatim
"transtyle": {
  "kind": "exporter",                 // or "importer"
  "name": "bootstrap",
  "irSpec": "v0-draft",               // IR spec it understands
  "pluginApi": "0",                   // plugin API range (any 0.x)
  "targets": { "bootstrap": [">=5.3 <6"] },   // framework version compat
  "modes": ["color-scheme"],          // mode dimensions it can express
  "capabilities": ["build"]
}
```

Core checks both when it loads the exporter ([versioning.md](versioning.md#load-time-compatibility-check)): `pluginApi` is a semver range that must accept the plugin API version core implements (`0.0.0` before the freeze, so `"0"` or `"^0"`), and `irSpec` must equal the IR spec core produces (`v0-draft`, a marker with no version number until the freeze). A mismatch stops the build with `TST1309`; a package without the manifest loads with a `TST1310` warning. `plugin-kit` checks the fields are present (`manifest-valid`) and accepted by this core (`manifest-compatible`).

## The exporter interface (v0, as implemented)

**One hook.** A plugin's default export is an object with a name and a single `emit`, which receives the fully resolved IR and returns the files to write, their coverage classification, and optionally diagnostics about the target's own conventions:

```ts
interface Exporter {
  name: string;
  emit(ir: ResolvedIR, ctx: TargetContext): { files: FileSpec[]; coverage: CoverageItem[]; diagnostics?: ExporterDiagnostic[] };
  optionsSchema?: JSONSchema;   // validated by core against `targets.<t>.options` (audit A8)
  openVocabulary?: boolean;     // the target has a place for any `semantic.*` token (below)
  doc?(...): DocPlan;           // reserved, capability-gated; no exporter implements it yet
}

type FileSpec     = { path: string; contents: string; kind: string };
type CoverageItem = { variable: string; slot: string; class: CoverageClass; provenance?: string; note?: string };
type CoverageClass = 'native' | 'derived' | 'approximated' | 'dropped' | 'unsupported';
type ExporterDiagnostic = { severity: 'info' | 'warning'; code: string; message: string; hint?: string };
```

**Exporter diagnostics** (issue #93) report what only the exporter knows: what its target's own conventions do to a value the design system authored (shadcn's `--radius-sm` collapsing to 0 under a small `radius.md`, `TST2104`). They are returned like `files` and `coverage`, not pushed into a collector, so `emit` stays a pure function the kit can double-run. Core validates them and adds them to the run's diagnostics with the target instance name in front of the message (`shadcn-v3: …`) and a `target` field. Severity is `info` or `warning` only: an exporter cannot stop the build from inside `emit`, and a malformed entry (an `error` severity, a missing code or message) is a contract violation reported as `TST3001`, like a throw.

Why one hook and not a `resolve`/`emit` split with core-evaluated JSON mapping tables (which earlier drafts of this document specified): eight exporters were written against the real interface and none needed the split. Mapping tables still exist — they're just **the exporter's own data structure**, declared in its source and applied by its own `emit`, which keeps the mapping and the emitting honest about each other. Coverage is returned by the exporter for the same reason: only the exporter knows whether a given mapping was lossless.

Constraints, enforced executably by the conformance kit rather than by convention: exporters receive an IR they must **not mutate**; they return file _descriptions_ and never touch the filesystem (nor import a Node built-in at all: `check:browser` loads every official exporter where none exists, since the same exporters run in a browser through `@transtyle/core/browser`); they have no access to other targets' resolutions (only the `ctx.siblings` manifest of names and paths); and `emit` must be **deterministic** — the kit double-runs it and diffs. Every file it returns has content, and **no JavaScript value in output**: no line carries `undefined`, `null` or `NaN` where a value belongs, or `NaN` / `[object Object]` anywhere. A slot with no value is a coverage row, never a stringified absence.

**Reads are observed, not declared** (issue #160). The mode maps `emit` receives are recording copies of the IR's (same keys, same entries, mode aliases still one object): core notes each catalog slot the exporter looks up (`get`, `has`) or opens while iterating, and reports the sorted list as the target's `reads` in `report.json`. Listing keys to filter them is not a read. It is what `check --matrix` answers "who reads this slot?" from, for third-party exporters as much as official ones, with nothing to add to the interface.

`ctx` carries the project config, this instance's `targetConfig` (with `options`), the color helpers (`formatColor`, `formatHex`, `formatHslTriplet`, `contrastRatio`, `mix`), `projectName`, `siblings`, `targetVersion` and `targetProfile` (below), `units` (`remBase`, `toPx(dimension)`, `toRem(dimension)`: unit conversion at the config's `units.remBase`, returning `undefined` for anything that is not a `px` or `rem` dimension), and `customTokens`: the design system's custom semantic tokens, the `semantic.*` paths it authored or aliased outside the catalog, in path order.

### Open-vocabulary targets

Most targets have a closed set of variables: a design system's custom semantic tokens have no place there, and core accounts for them after `emit` without the exporter doing anything ([validation-and-coverage.md](../specs/validation-and-coverage.md#custom-vocabulary)). A target with an **open** set (any custom property is valid output: css-variables, daisyUI's theme blocks) declares `openVocabulary: true` and writes every token of `ctx.customTokens`, with a `native` row naming it, or a row saying why it can't (daisyUI's theme block holds no composite). It also declares the `customTokens` option, `"emit"` (the default) or `"omit"`; with `"omit"` it writes none of them, and core reports each one `dropped`. The kit checks all three (`open-vocabulary-shape`, `custom-vocabulary-carried`, `custom-vocabulary-omit`). The flag only changes what core says about a token the output leaves out, so a closed-set exporter simply leaves it unset.

**Version profiles** ([ADR-0006](../adr/0006-version-ranges.md), [issue #83](https://github.com/transtyle/transtyle/issues/83)). An exporter supports version _ranges_ of its framework as mapping profiles: the manifest's `targets` lists one range per profile, oldest first. A project may request its version (`targets.<t>.version`); core selects the range covering it, so the exporter never parses version strings, and passes `ctx.targetVersion` (the requested version, or `null`) and `ctx.targetProfile` (the selected range; without a request, the newest one). The exporter keys its tables on that range string. A version outside every range is `TST1313` before `emit` runs. shadcn is the exporter with two profiles today (`">=3 <4"`, `">=4 <5"`: Tailwind versions, `options.era` kept as an override); the others declare one ([versioning.md](versioning.md#target-framework-versions-adr-0006)).

**Declarative exporters** ([ADR-0017](../adr/0017-declarative-exporters.md), [spec](../specs/declarative-mapping.md)). A JSON mapping table can be the whole exporter: core's runtime (`createDeclarativeExporter(mapping)`) turns it into an ordinary `{ name, emit }` that resolves each row, formats values with the `ctx` helpers and derives coverage from the rows. A target points at a mapping file (`"exporter": "./ourlib.mapping.json"`), or at a package whose manifest says `"declarative": "<file>"`, which the loader reads without importing anything. This is not the core-evaluated table stage the section above dropped: the runtime sits behind the same one-hook interface, and the kit tests it like any plugin.

## Importer interface (specced — no importer exists yet)

Importers are frontends: `import(source, ctx): DTCGDocument` — they emit the _source format_ (DTCG superset), not IR internals ([pipeline.md](pipeline.md#1-load)). This keeps import materializable (`transtyle import --write` produces token files the user can adopt and edit) and keeps importers decoupled from IR internals. Importers also emit an import-coverage report (what the source expressed that the IR cannot yet represent).

## The plugin-kit and conformance

`@transtyle/plugin-kit` (shipped, P1) exports `conformance(plugin, { manifest?, fixtures? })`. It runs the plugin against ten fixture design systems bundled with the kit (`fixtures/<name>/`, plain DTCG projects compiled by the real loader), so a plugin is tested on the shapes real projects come in, not one complete system:

| Fixture             | Exercises                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canonical`         | a brand color, both `color-scheme` modes, elevation, text, border, fonts; radius, a duration and an easing in DTCG structured form                             |
| `one-token`         | only `semantic.color.primary.solid`, the one token the engine cannot invent                                                                                    |
| `three-token`       | brand, page background and text, with dark values; no radius, spacing or fonts                                                                                 |
| `two-dimension`     | `color-scheme` × `density`, with `space.4` authored differently under `density: compact`                                                                       |
| `single-mode`       | `color-scheme` with `light` only                                                                                                                               |
| `component-tier`    | authored `component.control.radius`, `component.button.radius` (an alias to a derived slot), `component.button.padding-x`, `component.tooltip.max-width`       |
| `custom-role`       | a custom role joining the grid through `$extensions.transtyle.role`                                                                                            |
| `custom-vocabulary` | custom `semantic.*` tokens outside the catalog: a color bound to `primary.solid`, an unbound color, a dimension and a shadow                                   |
| `composites`        | authored shadow (per mode, stacked with `inset`, aliased), border, transition and typography                                                                   |
| `object-form`       | colors, dimensions, durations, cubicBezier, fontWeight, typography members and a fontFamily array in DTCG structured form, compared with their CSS-string twin |

Every fixture runs by default; `fixtures: 'canonical'` (or an array of names) narrows it. The kit asserts the contract above:

| Check                          | Asserts                                                                                                               |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `interface-shape`              | default export is `{ name: string, emit: function }`                                                                  |
| `manifest-valid`               | the `transtyle` manifest has `kind`, `name`, `irSpec`, `pluginApi`, `capabilities[]`                                  |
| `manifest-compatible`          | the manifest's `irSpec` and `pluginApi` accept what this `@transtyle/core` provides (the load-time `TST1309` check)   |
| `manifest-targets-ranges`      | every `targets` entry is a version range core can match (no era names, no prerelease tags), or `version` would fail   |
| `options-schema-shape`         | `optionsSchema`, if present, is a JSON-Schema object                                                                  |
| `emit-runs`                    | `emit` completes against a real resolved IR                                                                           |
| `emit-returns-files`           | `files` are `{ path, contents, kind }`                                                                                |
| `emit-returns-coverage`        | `coverage` items are `{ variable, slot, class }`                                                                      |
| `coverage-classes-valid`       | every class is one of the five                                                                                        |
| `emit-diagnostics-valid`       | `diagnostics`, if returned, are `{ severity: info\|warning, code, message, hint? }`                                   |
| `deterministic`                | two `emit` runs produce byte-identical files and diagnostics                                                          |
| `ir-immutable`                 | `emit` did not mutate the IR it was given                                                                             |
| `files-non-empty`              | every file has content                                                                                                |
| `no-leaked-values`             | no JavaScript value in output (the constraint above)                                                                  |
| `coverage-honest`              | no `native`/`derived` row names a slot that does not resolve (absence is not coverage)                                |
| `mode-dimensions-accounted`    | on `two-dimension`: the compact `density` value reaches a file, or a `(mode:density)` row says `dropped`              |
| `structured-values-as-strings` | on `object-form`: the files are byte-identical to the string-form twin's ([ir.md](ir.md#values-and-canonicalization)) |
| `open-vocabulary-shape`        | `openVocabulary`, if present, is a boolean, and `true` comes with a `customTokens: "emit" \| "omit"` option           |
| `custom-vocabulary-carried`    | on `custom-vocabulary`, for an open-vocabulary plugin: a row names every custom token                                 |
| `custom-vocabulary-omit`       | the same, with `customTokens: "omit"`: no row that emits names a custom token                                         |

The four manifest and interface checks run once per plugin (the manifest ones only with `{ manifest }`), the rest once per fixture, and each result names its fixture. Each check cites the spec line it enforces, so a failure points at the rule rather than at the kit. **The conformance suite is the real plugin spec** — prose drifts, executable fixtures don't. `npm run check:plugins` runs it over every official exporter and two declarative mappings in CI, with a deliberately broken plugin per check proving that check fails; passing is what "official" means, and community plugins can advertise it. Whether an authored token with no binding on a target may stay silent was settled by [#51](https://github.com/transtyle/transtyle/issues/51): it may not, and core, not the exporter, gives each custom semantic token its row. So a closed-set plugin needs nothing on `custom-vocabulary`, and only an open-vocabulary one is held to carrying them.

Its value is not theoretical: on its first run the kit caught `exporter-primeng` emitting `field` where the contract requires `variable` — a divergence that had also been silently producing `report.json` files violating the published report schema.

The built-in `css-variables` exporter is the living reference implementation — 271 lines, no target framework to satisfy, every slot `native`. Copy it before reading anything else.

```js
import { conformance } from '@transtyle/plugin-kit';
import plugin from './src/index.js';

const { pass, checks } = await conformance(plugin, { manifest: pkg.transtyle });
if (!pass) console.error(checks.filter((c) => !c.pass));
```

## Trust model

v1 plugins execute with full trust in the user's process — the same model as Babel/ESLint/Vite plugins, and the same supply-chain risks. We say so plainly in docs rather than implying safety we don't provide. Mitigations: static manifests reviewable pre-install; core's load-time check of the manifest (`TST1309`); conformance/registry metadata as a soft signal; and a **declarative-only** plugin class, shipped ([ADR-0017](../adr/0017-declarative-exporters.md)): a package whose manifest names a mapping file is read, never imported, so it runs no code at build time. **Specced:** `transtyle add <npm package>` installing a community exporter and printing its manifest and capability summary (and, for a declarative package, that no code will run) before it registers the target; today `add` takes official target names only.

## Anti-goals

No plugin-to-plugin dependencies or ordering (each target compiles independently — this is what keeps N targets from becoming N² interactions). No lifecycle hook soup (two hooks now; each addition must justify itself against the conformance kit's ability to test it). No core version lockstep (plugin API is its own semver line; see [versioning.md](versioning.md)).
