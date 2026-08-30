# @transtyle/exporter-daisyui

daisyUI backend for **[Transtyle](https://transtyle.github.io/transtyle/)**, a design system compiler.

> [!WARNING]
> **Alpha — experimental.** Breaking changes ship without a deprecation cycle: the token
> vocabulary, the generated output, the config format and the CLI surface can each change
> between alpha releases. Pin an exact version, and treat generated files as disposable
> output you regenerate — never as something to hand-edit and keep.
> ([why](https://github.com/transtyle/transtyle/blob/main/docs/adr/0010-pre-release-breaking-changes.md))

Emits `daisyui.transtyle.css` — daisyUI v5 theme blocks (`@plugin "daisyui/theme" { … }`,
Tailwind 4 era, OKLCH-native, so no colour conversion loss.

Worth knowing if you also use the shadcn target: daisyUI's `secondary` and `accent` are
true **brand** roles and map from the brand slots directly, not from subtle surfaces. Same
words, different meanings per ecosystem — the kind of false friend the pivot catalog exists
to keep straight.

## Use

```bash
npm i -D @transtyle/cli @transtyle/exporter-daisyui
npx transtyle add daisyui      # adds the target to transtyle.config.json
npx transtyle build daisyui
```

The CLI resolves exporters **from your project first**, so this package does not have to be
a dependency of the CLI itself. Every build writes a `usage.md` next to the artifacts
explaining how to wire them into that ecosystem, and a `report.json` recording where every
value came from and what the target could not express.

## Documentation

- [daisyUI exporter guide](https://transtyle.github.io/transtyle/docs/exporter-daisyui/)
- [The Transtyle language — false friends](https://transtyle.github.io/transtyle/docs/language/)

## License

MIT — part of the [Transtyle](https://github.com/transtyle/transtyle) monorepo.
