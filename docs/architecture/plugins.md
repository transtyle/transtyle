# Plugin architecture

> **Status: reconciled with the implementation (P1, 2026-07-22).** [ADR-0011](../adr/0011-v0-freeze-readiness.md) found this document described a richer contract than any exporter implemented. Rather than build toward prose no one used, the spec was **dropped to what all eight shipped exporters actually do**, and that contract is now executable: `@transtyle/plugin-kit` enforces it, and every official exporter passes it in CI. Formal *freezing* of the plugin API still waits for first publication (R4, currently parked) — but the spec below is no longer aspirational.

Plugins are the product's growth mechanism. The design optimizes for one metric: **a competent frontend engineer ships a working third-party exporter in a weekend, without reading core source.** ([ADR-0004](../adr/0004-plugin-packaging.md))

## Packaging

A plugin is an npm package. Official: `@transtyle/exporter-bootstrap`; community: anything, discoverable via the `transtyle-exporter` keyword and (later) registry metadata. No custom file archive format, no config-folder copying: npm already solves versioning, distribution, deprecation, and locking — a bespoke mechanism would re-solve all four, badly.

```
exporter-bootstrap/
  package.json          # declares: transtyle plugin manifest (see below)
  src/index.ts          # default export: the plugin object
  mappings/5.x.json     # declarative mapping profiles, one per supported version line
  test/                 # conformance kit + snapshot fixtures
```

`package.json` carries the manifest — static metadata readable *without executing the plugin* (needed for `transtyle add`, registry tooling, and trust review):

```jsonc
"transtyle": {
  "kind": "exporter",                 // or "importer"
  "name": "bootstrap",
  "irSpec": ">=0.1 <1",               // IR spec range it understands
  "pluginApi": "^0",                  // plugin API range
  "targets": { "bootstrap": [">=5.2 <6"] },   // framework version compat
  "modes": ["color-scheme"],          // mode dimensions it can express
  "capabilities": ["build", "doc"]    // doc = optional doc-generation support
}
```

## The exporter interface (v0, as implemented)

**One hook.** A plugin's default export is an object with a name and a single `emit`, which receives the fully resolved IR and returns both the files to write and their coverage classification:

```ts
interface Exporter {
  name: string;
  emit(ir: ResolvedIR, ctx: TargetContext): { files: FileSpec[]; coverage: CoverageItem[] };
  optionsSchema?: JSONSchema;   // validated by core against `targets.<t>.options` (audit A8)
  doc?(...): DocPlan;           // reserved, capability-gated; no exporter implements it yet
}

type FileSpec     = { path: string; contents: string; kind: string };
type CoverageItem = { variable: string; slot: string; class: CoverageClass; provenance?: string; note?: string };
type CoverageClass = 'native' | 'derived' | 'approximated' | 'dropped' | 'unsupported';
```

Why one hook and not a `resolve`/`emit` split with core-evaluated JSON mapping tables (which earlier drafts of this document specified): eight exporters were written against the real interface and none needed the split. Mapping tables still exist — they're just **the exporter's own data structure**, declared in its source and applied by its own `emit`, which keeps the mapping and the emitting honest about each other. Coverage is returned by the exporter for the same reason: only the exporter knows whether a given mapping was lossless.

Constraints, enforced executably by the conformance kit rather than by convention: exporters receive an IR they must **not mutate**; they return file *descriptions* and never touch the filesystem; they have no access to other targets' resolutions (only the `ctx.siblings` manifest of names and paths); and `emit` must be **deterministic** — the kit double-runs it and diffs.

`ctx` carries the project config, this instance's `targetConfig` (with `options`), the color helpers (`formatColor`, `formatHex`, `formatHslTriplet`, `contrastRatio`, `mix`), `projectName`, and `siblings`.

**Version profiles:** an exporter supports version *ranges* of its framework, expressed as mapping profiles plus conditional logic via `ctx.targetVersion` ([ADR-0006](../adr/0006-version-ranges.md)). Core selects the profile; the exporter never parses version strings itself.

## Importer interface

Importers are frontends: `import(source, ctx): DTCGDocument` — they emit the *source format* (DTCG superset), not IR internals ([pipeline.md](pipeline.md#1-load)). This keeps import materializable (`transtyle import --write` produces token files the user can adopt and edit) and keeps importers decoupled from IR internals. Importers also emit an import-coverage report (what the source expressed that the IR cannot yet represent).

## The plugin-kit and conformance

`@transtyle/plugin-kit` (shipped, P1) exports `conformance(plugin, { manifest? })`. It runs the plugin against a canonical fixture design system bundled with the kit — a brand color, both `color-scheme` modes, elevation, text, border, radius, fonts — and asserts the contract above:

| Check | Asserts |
|---|---|
| `interface-shape` | default export is `{ name: string, emit: function }` |
| `emit-runs` | `emit` completes against a real resolved IR |
| `emit-returns-files` | `files` are `{ path, contents, kind }` |
| `emit-returns-coverage` | `coverage` items are `{ variable, slot, class }` |
| `coverage-classes-valid` | every class is one of the five |
| `deterministic` | two `emit` runs produce byte-identical files |
| `ir-immutable` | `emit` did not mutate the IR it was given |
| `manifest-valid` | the `transtyle` manifest has `kind`, `name`, `irSpec`, `pluginApi`, `capabilities[]` |
| `options-schema-shape` | `optionsSchema`, if present, is a JSON-Schema object |

Each check cites the spec line it enforces, so a failure points at the rule rather than at the kit. **The conformance suite is the real plugin spec** — prose drifts, executable fixtures don't. `npm run check:plugins` runs it over all eight official exporters in CI; passing is what "official" means, and community plugins can advertise it.

Its value is not theoretical: on its first run the kit caught `exporter-primeng` emitting `field` where the contract requires `variable` — a divergence that had also been silently producing `report.json` files violating the published report schema.

The built-in `css-variables` exporter is intentionally trivial and serves as the living reference implementation.

```js
import { conformance } from '@transtyle/plugin-kit';
import plugin from './src/index.js';

const { pass, checks } = await conformance(plugin, { manifest: pkg.transtyle });
if (!pass) console.error(checks.filter((c) => !c.pass));
```

## Trust model

v1 plugins execute with full trust in the user's process — the same model as Babel/ESLint/Vite plugins, and the same supply-chain risks. We say so plainly in docs rather than implying safety we don't provide. Mitigations, in order of arrival: static manifests reviewable pre-install; `transtyle add` prints the manifest + capability summary before installing; conformance/registry metadata as a soft signal; **later, if warranted:** a `declarative-only` plugin class (mappings without code) that *can* be loaded without execution — worth designing toward, since most exporters are 90% tables.

## Anti-goals

No plugin-to-plugin dependencies or ordering (each target compiles independently — this is what keeps N targets from becoming N² interactions). No lifecycle hook soup (two hooks now; each addition must justify itself against the conformance kit's ability to test it). No core version lockstep (plugin API is its own semver line; see [versioning.md](versioning.md)).
