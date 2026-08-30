# @transtyle/exporter-primeng

## 0.1.0-alpha.0

### Minor Changes

- First public alpha.

  Transtyle compiles a framework-agnostic description of a design system — DTCG tokens plus semantics and modes — into native theme artifacts for eight targets: Bootstrap, shadcn/ui, daisyUI, Apache ECharts, Storybook, Radix Colors/Themes, PrimeNG, and plain CSS variables. Unauthored values are filled by deterministic, inspectable derivation rules rather than hidden defaults, every generated value carries provenance you can query with `transtyle explain`, and every build emits a coverage report saying what mapped natively, what was derived, what was approximated, and what the target cannot express.

  All three token tiers — raw/option, semantic and component — are mapped on the two component-heavy targets, Bootstrap and PrimeNG, each measured against a checked-in inventory of the target's real theming surface so gaps are reported rather than quietly skipped.

  Import is DTCG only in this release. Tailwind, Figma and CSS-custom-property importers are post-alpha.

  **This is an experimental alpha.** Breaking changes ship without a deprecation cycle: the token vocabulary, the generated output, the config format and the CLI surface can each change between alpha releases, and none of it carries a stability or support promise. Pin an exact version, and treat generated files as disposable output you regenerate rather than hand-edit. The reasoning is recorded in ADR-0010; the release process is documented in RELEASING.md.

### Patch Changes

- Updated dependencies
  - @transtyle/ir@0.1.0-alpha.0
