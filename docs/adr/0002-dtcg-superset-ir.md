# ADR-0002: Source format is a DTCG superset, not proprietary

**Status:** accepted

## Context

The token source format could be (a) a bespoke format optimized for our features, or (b) the W3C Design Tokens Community Group format extended via its sanctioned `$extensions` mechanism. DTCG is not final and lacks concepts we need (modes, tiers, derivation) — but it is the only interop point the ecosystem (Figma variables, Tokens Studio, Style Dictionary v4, Terrazzo) is converging on.

## Decision

Token files are valid DTCG documents; all additions live in the namespaced `$extensions` or in the separate build manifest ([configuration.md](../specs/configuration.md)). When DTCG standardizes a concept we extended, we deprecate our extension in its favor with a `transtyle migrate` codemod.

## Consequences

- Free interop both directions: any DTCG producer is a zero-cost importer; our files degrade gracefully in any DTCG consumer (extensions ignored, default-mode values remain sensible).
- Credibility with the design-system community; a proprietary format would read as yet another silo ([prior-art.md](../prior-art.md)).
- Cost accepted: DTCG's verbosity (`$value`/`$type` ceremony) and its unfinished corners; mode-in-`$extensions` syntax is uglier than a native design would be. We also inherit spec-evolution risk — mitigated by the migration commitment and by keeping extensions deletable.
- The extension namespace string ships inside user files → naming must be final before first release ([naming.md](../naming.md)).
