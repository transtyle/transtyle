# Plugin architecture

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

## The exporter interface (conceptual v0)

Small on purpose. Two layers:

**1. Declarative mappings (the bulk of most exporters).** JSON tables from semantic slots to target variables, evaluated by core. Declarative mappings are introspectable — they power coverage classification, `explain --target`, and future tooling (e.g. a mapping-table docs generator) with zero exporter code.

```jsonc
// mappings/5.x.json (excerpt)
{ "$primary":        { "from": "semantic.color.primary.base", "class": "native" },
  "$border-radius":  { "from": "semantic.radius.md", "unit": "rem", "class": "native" },
  "$success-bg-subtle": { "from": "semantic.color.success.subtle", "class": "native" } }
```

**2. Programmatic hooks (the escape hatch), all pure functions over the resolved IR:**

```ts
interface Exporter {
  resolve?(ir: ResolvedIR, ctx: TargetContext): ResolutionPatch;  // beyond-table logic (e.g. palette generation)
  emit(resolution: Resolution, ctx: TargetContext): FileSpec[];   // → { path, contents, kind }[]
  doc?(resolution: Resolution, ctx: DocContext): DocPlan;         // optional, capability-gated
}
```

Constraints enforced by core, not convention: exporters receive an **immutable** IR snapshot; they return file *descriptions* and never touch the filesystem; they have no access to other targets' resolutions; `emit` must be deterministic (the conformance kit double-runs it and diffs).

**Version profiles:** an exporter supports version *ranges* of its framework, expressed as mapping profiles plus conditional logic via `ctx.targetVersion` ([ADR-0006](../adr/0006-version-ranges.md)). Core selects the profile; the exporter never parses version strings itself.

## Importer interface

Importers are frontends: `import(source, ctx): DTCGDocument` — they emit the *source format* (DTCG superset), not IR internals ([pipeline.md](pipeline.md#1-load)). This keeps import materializable (`transtyle import --write` produces token files the user can adopt and edit) and keeps importers decoupled from IR internals. Importers also emit an import-coverage report (what the source expressed that the IR cannot yet represent).

## The plugin-kit and conformance

`@transtyle/plugin-kit` ships: TypeScript types, a test harness (`conformance(plugin)`) that runs a canonical fixture design system through the plugin and asserts determinism, manifest validity, IR-range honesty, and snapshot stability; plus authoring docs. **The conformance suite is the real plugin spec** — prose drifts, executable fixtures don't. Passing it is required for the "official" label and listed in registry metadata for community plugins.

The built-in `css-variables` exporter is intentionally trivial and serves as the living reference implementation.

## Trust model

v1 plugins execute with full trust in the user's process — the same model as Babel/ESLint/Vite plugins, and the same supply-chain risks. We say so plainly in docs rather than implying safety we don't provide. Mitigations, in order of arrival: static manifests reviewable pre-install; `transtyle add` prints the manifest + capability summary before installing; conformance/registry metadata as a soft signal; **later, if warranted:** a `declarative-only` plugin class (mappings without code) that *can* be loaded without execution — worth designing toward, since most exporters are 90% tables.

## Anti-goals

No plugin-to-plugin dependencies or ordering (each target compiles independently — this is what keeps N targets from becoming N² interactions). No lifecycle hook soup (two hooks now; each addition must justify itself against the conformance kit's ability to test it). No core version lockstep (plugin API is its own semver line; see [versioning.md](versioning.md)).
