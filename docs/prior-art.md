# Prior art and competitive landscape

An honest map of what exists. If we cannot articulate why each of these doesn't already solve the problem, we should not build this project. Claims below should be re-verified against current releases before implementation starts.

## Token pipelines (closest neighbors)

### Style Dictionary (Amazon)

The incumbent. Transforms token files through configurable transform/format chains into platform outputs (CSS vars, Sass, iOS, Android). Mature, huge adoption, DTCG support added in v4.

**Gap we fill:** Style Dictionary is a _mechanical_ transformer — it flattens tokens into variables and requires the user to author the mapping to each framework themselves. It has no semantic understanding (no notion that `danger` maps to Bootstrap's `$danger`), no derivation of missing tokens, no version awareness of targets, no coverage reporting, no framework-native artifact generation (it emits variables, not a Bootstrap theme). It is a lower layer; we could even use it as an emit backend internally.

### Terrazzo (formerly Cobalt UI)

DTCG-native, plugin-based token compiler (CSS, Sass, JS, Tailwind plugins). Philosophically closest to us and validates the DTCG-plugin architecture.

**Gap we fill:** same category of gap as Style Dictionary — outputs are variable files, not framework-native themes; no semantic mapping layer, no derivation engine, no importers from existing ecosystems, no docs/preview story.

### Theo (Salesforce)

Early token transformer, effectively in maintenance. Historical interest only.

### Diez (defunct)

Attempted "design language as code" with framework compilation. Died partly from trying to own the runtime (shipped SDKs into apps) — a cautionary tale that directly motivates our non-goal #1 (no runtime).

## Token management platforms

### Tokens Studio (Figma plugin + platform)

Manages tokens in Figma, syncs to git, exports via Style Dictionary-style transforms. Strong on the design-tool side, weak on framework-native output.

**Relationship:** importer source, not competitor. Their output is our input.

### Specify (shut down), Supernova, Knapsack

Commercial DS platforms with export pipelines. Supernova is the closest commercial analog (hosted, code-gen to multiple targets).

**Gap we fill:** open-source, local-first, CLI/CI-native, no vendor lock-in. The Terraform-vs-proprietary-cloud-console dynamic.

## Framework-specific theming tools

Each ecosystem has one-off theme builders (Bootstrap build tools, shadcn theme generators like tweakcn, MUI theme creator, ECharts theme builder). They prove demand for every single target we plan — and each is a silo with no shared source of truth.

## What no one does today

| Capability                                      | SD  | Terrazzo | Tokens Studio | Supernova | us  |
| ----------------------------------------------- | --- | -------- | ------------- | --------- | --- |
| DTCG source format                              | ✅  | ✅       | partial       | partial   | ✅  |
| Framework-native artifacts (not just variables) | ❌  | ❌       | ❌            | partial   | ✅  |
| Semantic role model (primary/danger/surface…)   | ❌  | ❌       | ❌            | partial   | ✅  |
| Deterministic derivation of missing tokens      | ❌  | ❌       | ❌            | ❌        | ✅  |
| Target version awareness                        | ❌  | ❌       | ❌            | ❌        | ✅  |
| Coverage / fidelity report                      | ❌  | ❌       | ❌            | ❌        | ✅  |
| Importers (reverse direction)                   | ❌  | ❌       | Figma only    | partial   | ✅  |
| Open source                                     | ✅  | ✅       | partial       | ❌        | ✅  |

## Strategic implications

1. **Do not compete on token transformation.** That layer is commoditized. Our value is the semantic layer, derivation, native artifacts, and reversibility. Where sensible, interoperate with Style Dictionary/Terrazzo rather than re-implementing their transforms.
2. **DTCG alignment is table stakes** ([ADR-0002](adr/0002-dtcg-superset-ir.md)). A proprietary format would make us a silo like the one-off theme builders.
3. **Diez's corpse marks the cliff edge:** no runtime, no SDK, no ownership of the user's app. Files out, nothing in.
4. **The DTCG spec is still evolving** (modes/theming are notably unresolved upstream). Our extensions must be designed to be deletable when the spec catches up — see [docs/architecture/ir.md](architecture/ir.md).
