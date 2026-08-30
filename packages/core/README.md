<p align="center">
  <a href="https://transtyle.github.io/transtyle/"><img src="https://raw.githubusercontent.com/transtyle/transtyle/main/brand/transtyle-mark-on-dark-256.png" alt="Transtyle" width="88" height="88"></a>
</p>

# @transtyle/core

The compilation pipeline behind **[Transtyle](https://transtyle.github.io/transtyle/)** — a design system compiler: describe a design system once as W3C (DTCG) design tokens, compile native theme artifacts for every ecosystem.

> [!WARNING]
> **Alpha — experimental.** Breaking changes ship without a deprecation cycle: the token
> vocabulary, the generated output, the config format and the CLI surface can each change
> between alpha releases. Pin an exact version, and treat generated files as disposable
> output you regenerate — never as something to hand-edit and keep.
> ([why](https://github.com/transtyle/transtyle/blob/main/docs/adr/0010-pre-release-breaking-changes.md))

Most people never install this directly: `@transtyle/cli` depends on it. Install it when you
want to run the compiler from your own code — a build script, a CI check, a playground.

## Use

```js
import { compile } from '@transtyle/core';

const result = await compile({ cwd: process.cwd(), emit: false });
console.log(result.report.coverage);
```

## What it does

Six phases, in order: **load** (DTCG token files) → **normalize** (one canonical tree) →
**derive** (fill every slot you did not author, by versioned deterministic rules) →
**resolve** (per mode combination) → **emit** (hand the resolved IR to each exporter) →
**report**. Nothing is random and nothing depends on the clock or the filesystem order, so
two builds of the same input are byte-identical — there is a check in CI that proves it.

Also exported: `diffResolved` and `contrastRegressions` (the semantic diff), `Diagnostics`,
and the colour module — `formatColor`, `formatHex`, `formatHslTriplet`, `contrastRatio`,
`mix` — which is OKLCH-native and has no dependencies.

**Zero external dependencies**, deliberately.

## Documentation

- [How Transtyle works](https://transtyle.github.io/transtyle/docs/how-transtyle-works/)
- [Internals](https://transtyle.github.io/transtyle/docs/internals/)
- [Derivation](https://transtyle.github.io/transtyle/docs/derivation/)

## License

MIT — part of the [Transtyle](https://github.com/transtyle/transtyle) monorepo.
