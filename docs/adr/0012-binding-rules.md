# ADR-0012: Binding rules are config data that expands into plain aliases at LOAD

**Status:** accepted

## Context

[ADR-0009](0009-token-layering.md) made bindings pure DTCG alias files: one alias per catalog slot. For a regular vocabulary (Material's `primary` / `on-primary` per role, a `brand.50` to `brand.950` ramp per role, a vocabulary of about a hundred colors) that is dozens to hundreds of near-identical lines, and every new role repeats them. The advice to bind by meaning is right; the cost of writing it was the problem ([issue #59](https://github.com/transtyle/transtyle/issues/59)).

## Decision

The manifest takes an optional `bindings` array of rules, `{ slot, from, roles?, required? }`, where `slot` and `from` may use the placeholders `{role}`, `{rung}` and `{level}` (the built-in plus opted-in custom roles, the text rungs, the elevation levels). LOAD expands the rules into one more base layer of ordinary alias tokens, appended after every token file, before NORMALIZE. Nothing downstream changes: the IR, exporters and `diff` see aliases. The one trace is a `rule` on the alias's provenance, which `explain` prints. `transtyle bindings --expand` prints the layer as a token file, so a team can freeze it.

- **Explicit bindings win.** A token or alias already authored in a token file beats any rule, silently (overriding one cell of a regular grid is the normal case). Between rules the first in the array wins and the later one gets an `info` note (`TST1119`). Authored tokens always win is a standing rule of the compiler; this extends it.
- **A rule resolves to a missing token: skip.** One rule covers the whole grid and binds what the vocabulary has. `required: true` turns a missing target into an error (`TST1118`). A malformed rule is `TST1117`.
- **Deterministic by construction.** Placeholders iterate fixed ordered sets (custom roles sorted by name), the cross product has a fixed order, rules apply in array order.
- **Targets are authored tokens.** A rule cannot point at a slot DERIVE materializes or at another rule's slot, so expansion is a single pass that needs no derivation and cannot loop.

## Alternatives not taken

- **A token-file feature (rules inside a `.tokens.json`).** Rejected: ADR-0009 keeps token files pure DTCG so generated files stay tool-ingestible; transtyle-specific syntax lives in the manifest.
- **`{step}` for ramp steps** (`brand.50…950`, iterating the keys under a group). Deferred: it needs its own key-discovery rule. Steps are written literally today (`.600`), which already collapses the per-role repetition that motivated the issue.
- **Expansion in the IR** (a rule kept as a first-class IR node). Rejected: every exporter and `diff` would learn a new concept for no gain.

## Consequences

- Config grows one key; the published config schema and `config/v0.json` are regenerated (`gen:schemas`).
- Three diagnostic codes are appended: `TST1117`, `TST1118`, `TST1119`.
- The acceptance of #59 ("Carbon's bindings replaced by at most 10 rules") was changed on the issue's own refinement: Carbon's bindings are hand-picked per role (`danger.solid` is `carbon.support-error`), so no pattern covers them. The proof is a new fixture with a regular vocabulary whose six rules expand to the byte-identical output of the plain alias file (`packages/core/test-fixtures/bindings-rules`, checked by `check:cli`). Carbon is unchanged.
