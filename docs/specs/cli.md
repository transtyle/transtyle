# CLI specification

## Design corrections from the original vision

The pitched invocation was `npx @transtyle/translate bootstrap 5.3.8`. Three changes, each deliberate:

1. **One binary, subcommands** (`transtyle build`), not per-action packages. Per-action packages fragment docs, version skew between them is user-hostile, and every serious tool in the reference class (git, terraform, cargo, babel) converged on one binary.
2. **Targets live in config; CLI selects.** `transtyle build` builds everything configured; `transtyle build bootstrap` filters. Version pinning belongs in config (reviewed, locked), with `@version` as an ad-hoc override — inverting this ("version only on CLI") makes builds unreproducible.
3. **Range-based version targeting**, not patch promises ([ADR-0006](../adr/0006-version-ranges.md)).

## Command surface (v1)

```
transtyle init                      scaffold tokens/ + transtyle.config.json (interactive; --yes for defaults)
transtyle add <plugin>...           install + register exporters/importers (resolves @transtyle/exporter-<name>,
                              falls back to exact npm name for community plugins; prints manifest before install)
transtyle build [target...]         compile (all targets or listed subset)
      --out <dir>             override output root
      --frozen                fail on lockfile drift (default in CI)
      --dry-run               full pipeline, print file list + coverage, write nothing
transtyle check [target...]         pipeline minus emit: validation, contrast, coverage, drift detection
      --fail-on <level>       override config policy (error|warning|approximation)
      --json                  machine-readable report to stdout
transtyle explain <token> [--target <t>] [--mode <dim>=<v>]
                              provenance chain: authored where / derived by which rule from what /
                              mapped to which target variable and why
transtyle import <source> [--write] materialize an importer's output as token files (review, then adopt)
transtyle diff [<git-ref>]          semantic diff of resolved IR vs ref (default: HEAD); per-target impact summary
transtyle migrate                   apply codemods across IR-spec / rule-pack upgrades
```

Phase 2+: `transtyle preview` (local themed preview server), `transtyle doc <target>` (experimental; [doc-generation.md](doc-generation.md)), `transtyle watch` (or `build --watch`).

## `explain` — the trust command

The feature that makes derivation acceptable. Example output shape:

```
$ transtyle explain semantic.color.text-on-primary.base --target bootstrap
semantic.color.text-on-primary.base = oklch(1 0 0)  [#ffffff]
 └─ derived by rule contrast-pick@standard@1
    inputs: semantic.color.primary.base = oklch(0.55 0.18 255)   ← authored tokens/brand.tokens.json:6
    candidates: #fff (5.9:1 ✓), #000 (3.5:1 ✗) — selected #fff (WCAG AA)
 └─ bootstrap@5.3 profile → $btn-color, --bs-btn-color   [class: native]
```

## Behavioral contracts

- **Exit codes:** 0 success; 1 diagnostics at/above the fail-on threshold; 2 usage/config errors. Stable, documented, CI-safe.
- **Output streams:** human logs → stderr; requested data (`--json`, `explain`) → stdout. Pipeable by construction.
- **Non-interactive by default** when not a TTY; anything interactive has a flag equivalent.
- **No telemetry.** If ever proposed, opt-in only, and it gets its own ADR and public schema.
- **Respects** `NO_COLOR`, `--quiet`, `--verbose`.

## Programmatic parity

Every command is a thin wrapper over `@transtyle/core` public API (`compile()`, `check()`, `explainToken()`, `diff()`). Guaranteed parity — the CLI never contains logic a build-tool integration can't reach.
