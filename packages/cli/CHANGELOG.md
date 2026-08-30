# @transtyle/cli

## 0.1.0-alpha.1

### Patch Changes

- f71c23c: Write `bin.transtyle` as `src/main.js` rather than `./src/main.js`.

  npm normalizes bin paths when publishing. On npm 10.x the leading `./` was silently cleaned; on newer npm the same field is reported as "invalid and removed", which publishes a CLI package with no `transtyle` command. `0.1.0-alpha.0` was cleaned rather than stripped and is intact, but the field is now written in the form npm expects so the outcome no longer depends on the publisher's npm version.

  A new `check:manifests` guard covers the class: it verifies `publishConfig.access`, provenance metadata, that every `files` entry exists, and that `main`/`exports`/`bin` all resolve, sit inside the `files` allowlist, and (for `bin`) carry a shebang and an executable bit — none of which is observable from inside the workspace, where the binary is already linked.
  - @transtyle/core@0.1.0-alpha.1
  - @transtyle/exporter-bootstrap@0.1.0-alpha.1
  - @transtyle/exporter-css-variables@0.1.0-alpha.1
  - @transtyle/exporter-daisyui@0.1.0-alpha.1
  - @transtyle/exporter-echarts@0.1.0-alpha.1
  - @transtyle/exporter-primeng@0.1.0-alpha.1
  - @transtyle/exporter-radix@0.1.0-alpha.1
  - @transtyle/exporter-shadcn@0.1.0-alpha.1
  - @transtyle/exporter-storybook@0.1.0-alpha.1

## 0.1.0-alpha.0

### Minor Changes

- First public alpha.

  Transtyle compiles a framework-agnostic description of a design system — DTCG tokens plus semantics and modes — into native theme artifacts for eight targets: Bootstrap, shadcn/ui, daisyUI, Apache ECharts, Storybook, Radix Colors/Themes, PrimeNG, and plain CSS variables. Unauthored values are filled by deterministic, inspectable derivation rules rather than hidden defaults, every generated value carries provenance you can query with `transtyle explain`, and every build emits a coverage report saying what mapped natively, what was derived, what was approximated, and what the target cannot express.

  All three token tiers — raw/option, semantic and component — are mapped on the two component-heavy targets, Bootstrap and PrimeNG, each measured against a checked-in inventory of the target's real theming surface so gaps are reported rather than quietly skipped.

  Import is DTCG only in this release. Tailwind, Figma and CSS-custom-property importers are post-alpha.

  **This is an experimental alpha.** Breaking changes ship without a deprecation cycle: the token vocabulary, the generated output, the config format and the CLI surface can each change between alpha releases, and none of it carries a stability or support promise. Pin an exact version, and treat generated files as disposable output you regenerate rather than hand-edit. The reasoning is recorded in ADR-0010; the release process is documented in RELEASING.md.

### Patch Changes

- Updated dependencies
  - @transtyle/core@0.1.0-alpha.0
  - @transtyle/exporter-bootstrap@0.1.0-alpha.0
  - @transtyle/exporter-css-variables@0.1.0-alpha.0
  - @transtyle/exporter-daisyui@0.1.0-alpha.0
  - @transtyle/exporter-echarts@0.1.0-alpha.0
  - @transtyle/exporter-primeng@0.1.0-alpha.0
  - @transtyle/exporter-radix@0.1.0-alpha.0
  - @transtyle/exporter-shadcn@0.1.0-alpha.0
  - @transtyle/exporter-storybook@0.1.0-alpha.0
