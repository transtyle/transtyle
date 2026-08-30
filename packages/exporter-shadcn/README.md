# @transtyle/exporter-shadcn

shadcn/ui backend for **[Transtyle](https://transtyle.github.io/transtyle/)**, a design system compiler.

> [!WARNING]
> **Alpha — experimental.** Breaking changes ship without a deprecation cycle: the token
> vocabulary, the generated output, the config format and the CLI surface can each change
> between alpha releases. Pin an exact version, and treat generated files as disposable
> output you regenerate — never as something to hand-edit and keep.
> ([why](https://github.com/transtyle/transtyle/blob/main/docs/adr/0010-pre-release-breaking-changes.md))

Emits `globals.transtyle.css` — light and dark, `@theme inline`, OKLCH — which drops into
any Tailwind v4 shadcn project.

Two era profiles, selected by `options.era` in `transtyle.config.json` (never a CLI flag,
so a build is reproducible from the config alone):

- **`tailwind-v4`** (default) — OKLCH custom properties and `@theme inline`
- **`tailwind-v3`** — HSL channel triplets plus a `tailwind.theme.transtyle.cjs` snippet

## Use

```bash
npm i -D @transtyle/cli @transtyle/exporter-shadcn
npx transtyle add shadcn      # adds the target to transtyle.config.json
npx transtyle build shadcn
```

The CLI resolves exporters **from your project first**, so this package does not have to be
a dependency of the CLI itself. Every build writes a `usage.md` next to the artifacts
explaining how to wire them into that ecosystem, and a `report.json` recording where every
value came from and what the target could not express.

## Documentation

- [shadcn exporter guide](https://transtyle.github.io/transtyle/docs/exporter-shadcn/)
- [Getting started](https://transtyle.github.io/transtyle/docs/getting-started/)

## License

MIT — part of the [Transtyle](https://github.com/transtyle/transtyle) monorepo.
