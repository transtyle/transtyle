# @transtyle/cli

The command line for **[Transtyle](https://transtyle.github.io/transtyle/)**, a design system compiler: describe a design system once as W3C (DTCG) design tokens, compile native theme artifacts for every ecosystem.

> [!WARNING]
> **Alpha — experimental.** Breaking changes ship without a deprecation cycle: the token
> vocabulary, the generated output, the config format and the CLI surface can each change
> between alpha releases. Pin an exact version, and treat generated files as disposable
> output you regenerate — never as something to hand-edit and keep.
> ([why](https://github.com/transtyle/transtyle/blob/main/docs/adr/0010-pre-release-breaking-changes.md))

## Use

```bash
npm i -D @transtyle/cli
npx transtyle init               # scaffold transtyle.config.json + starter tokens
npx transtyle add bootstrap      # add a target
npx transtyle build              # compile every configured target
```

## Commands

| Command           | Does                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------- |
| `init`            | Scaffold a config and a starter token file                                            |
| `add <target>`    | Add one of the eight official targets to the config                                   |
| `build [target…]` | Compile — writes artifacts, `usage.md` and `report.json`                              |
| `check`           | The whole pipeline without emitting: validation, contrast, coverage                   |
| `explain <slot>`  | Why one token has the value it has, rule by rule, with provenance                     |
| `diff [ref]`      | Semantic diff of the resolved graph against a git ref, including contrast regressions |

`build` and `check` exit non-zero on error; `diff` uses `git diff`-style exit codes. Every
command takes `--json` where a machine might be reading, and diagnostics carry stable
`TST`-prefixed codes — the CLI is meant to be driven by agents as well as people.

## Targets

`shadcn`, `daisyui`, `bootstrap`, `echarts`, `storybook`, `css-variables`, `radix`, `primeng`.
Third-party exporters work the same way: name the package in `targets` and it is loaded
from your project.

## Documentation

- [CLI reference](https://transtyle.github.io/transtyle/docs/cli/)
- [Getting started](https://transtyle.github.io/transtyle/docs/getting-started/)
- [Diagnostics](https://transtyle.github.io/transtyle/docs/diagnostics/)

## License

MIT — part of the [Transtyle](https://github.com/transtyle/transtyle) monorepo.
