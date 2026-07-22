# Naming

## Decision (2026-07-18): **Transtyle**

Transpile × style. The product is a source-to-source compiler for design systems; the name states the mechanism (transpilation) and the domain (styling) in one coined, pronounceable, verb-able word ("transtyle your design system to Bootstrap"). As a coined word it owns its search results and carries low trademark risk.

**Secured:** npm org (`@transtyle`) and GitHub org — registered 2026-07-18.
**Remaining:** `transtyle.dev` / `transtyle.com` domains; formal trademark search; rename this repository to `transtyle`.

## Canonical identifiers (now frozen)

| Identifier                | Value                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| CLI binary                | `transtyle`                                                                                               |
| npm scope                 | `@transtyle/*` (`core`, `cli`, `ir`, `plugin-kit`, `exporter-*`, `importer-*`)                            |
| Config file               | `transtyle.config.json`                                                                                   |
| DTCG extension namespace  | `transtyle.*` (e.g. `transtyle.modes`) — ships inside user token files; frozen at first public IR release |
| package.json manifest key | `"transtyle"`                                                                                             |
| Plugin discovery keyword  | `transtyle-exporter` / `transtyle-importer`                                                               |
| Diagnostic code prefix    | `TST####`                                                                                                 |
| Lockfile / build manifest | `transtyle.lock`, `transtyle-manifest.json`                                                               |
| Generated-file infix      | `*.transtyle.*` (e.g. `_variables.transtyle.scss`)                                                        |

## Selection history

Criteria: pronounceable across languages; short enough for a CLI; npm/GitHub/domain/trademark availability; evocative of _translation/compilation_ rather than design alone. The transpiler framing is technically accurate — we translate between same-level representations through an IR, which is source-to-source compilation.

Rejected after availability verification against the npm registry (2026-07-18): `dialekt` (active AI CLI tool, published 2026-07 — the strongest conceptual alternative, killed by a live collision), `koine` (taken + i18n project), `transpose`, `retheme`, `refract` (also the API Blueprint parse format), `kaleido` (also Plotly's export engine), `tokamak` / `alloy` / `portage` (crowded namespaces). Runner-up `interlingua` (the machine-translation term for a universal pivot language — conceptually exact) was free on npm but long, and its GitHub org is occupied. `themec` and `themeport` were available but "theme" undersells a design-system compiler.
