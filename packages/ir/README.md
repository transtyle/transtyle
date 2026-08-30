<p align="center">
  <a href="https://transtyle.github.io/transtyle/"><img src="https://raw.githubusercontent.com/transtyle/transtyle/main/brand/transtyle-mark-on-dark-256.png" alt="Transtyle" width="88" height="88"></a>
</p>

# @transtyle/ir

The semantic catalog and intermediate representation of **[Transtyle](https://transtyle.github.io/transtyle/)**, a design system compiler.

> [!WARNING]
> **Alpha — experimental.** Breaking changes ship without a deprecation cycle: the token
> vocabulary, the generated output, the config format and the CLI surface can each change
> between alpha releases. Pin an exact version, and treat generated files as disposable
> output you regenerate — never as something to hand-edit and keep.
> ([why](https://github.com/transtyle/transtyle/blob/main/docs/adr/0010-pre-release-breaking-changes.md))

This is the pivot vocabulary every importer writes into and every exporter reads out of —
the LLVM-IR of the analogy. It is deliberately small, and it grows only when two independent
ecosystems need the same concept.

Install it when you are **writing an exporter** or otherwise reading the IR; the compiler
already depends on it.

## What is in here

`IR`, `COLOR`, `ROLE`, `GRID`, `TEXT`, `ELEVATION`, `SHADOW`, `Z`, `COMPONENT`, `RESERVED` —
the catalog constants; `PROVENANCE` and `COVERAGE` — the vocabularies for _where a value came
from_ and _how honestly a target expressed it_; plus token-tree helpers (`collectTokens`,
`mergeTrees`, `aliasTarget`, `expandModeMatrix`, `comboKey`, `droppedDimensions`,
`collectRoleArchetypes`).

**Zero dependencies.**

## Documentation

- [The Transtyle language](https://transtyle.github.io/transtyle/docs/language/)
- [Concepts](https://transtyle.github.io/transtyle/docs/concepts/)
- [Write an exporter](https://transtyle.github.io/transtyle/docs/write-an-exporter/)

## License

MIT — part of the [Transtyle](https://github.com/transtyle/transtyle) monorepo.
