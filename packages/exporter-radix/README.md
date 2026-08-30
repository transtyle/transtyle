# @transtyle/exporter-radix

Radix Colors backend for **[Transtyle](https://transtyle.github.io/transtyle/)**, a design system compiler.

> [!WARNING]
> **Alpha — experimental.** Breaking changes ship without a deprecation cycle: the token
> vocabulary, the generated output, the config format and the CLI surface can each change
> between alpha releases. Pin an exact version, and treat generated files as disposable
> output you regenerate — never as something to hand-edit and keep.
> ([why](https://github.com/transtyle/transtyle/blob/main/docs/adr/0010-pre-release-breaking-changes.md))

Emits `radix-colors.transtyle.css` — Radix-shaped 12-step scales per role, both modes.

This target doubles as the semantic catalog's hardest acceptance test. Radix's twelve steps
_are_ the role grid, numbered instead of named, and they were designed by someone else: if
each step maps cleanly from a catalog cell that already existed, the grid is a universal
projection rather than a shape invented to fit one framework. Only two of twelve need a
fresh mix (steps 2 and 6), and both are reported as `approximated`.

## Use

```bash
npm i -D @transtyle/cli @transtyle/exporter-radix
npx transtyle add radix      # adds the target to transtyle.config.json
npx transtyle build radix
```

The CLI resolves exporters **from your project first**, so this package does not have to be
a dependency of the CLI itself. Every build writes a `usage.md` next to the artifacts
explaining how to wire them into that ecosystem, and a `report.json` recording where every
value came from and what the target could not express.

## Documentation

- [Radix exporter guide](https://transtyle.github.io/transtyle/docs/exporter-radix/)
- [The role grid](https://transtyle.github.io/transtyle/docs/language/)

## License

MIT — part of the [Transtyle](https://github.com/transtyle/transtyle) monorepo.
