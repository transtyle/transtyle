# Vision

## The problem

Every team that builds a design system pays the same tax repeatedly: the system is defined once (in Figma, in a brand book, in someone's head) and then re-implemented by hand for every technology it touches — a Tailwind config, a Bootstrap Sass override file, an ECharts theme, a Storybook theme, a Material UI theme object. Each re-implementation drifts. Each framework upgrade breaks one of them. Nobody knows which copy is current.

Existing token tooling (Style Dictionary, Terrazzo) solves the *bottom half* of this problem: it transforms token files into flat variable files. It does not solve the *top half*: understanding what a design system means semantically ("this is the danger color", "this is the interactive-surface radius") and producing configurations that are **native and idiomatic** for a specific framework at a specific version — the difference between emitting 400 CSS variables and emitting a `_variables.scss` that Bootstrap actually consumes, or an ECharts theme JSON with a derived categorical palette.

## The bet

**A design system is a compilable artifact.** If we define a sufficiently expressive intermediate representation (IR) and a disciplined plugin contract, then:

- one source of truth can target arbitrarily many ecosystems;
- ecosystems become interchangeable (import from Bootstrap, export to shadcn/ui);
- upgrades become recompilation instead of migration projects;
- the design system itself becomes portable, reviewable, versionable infrastructure — like Terraform made infrastructure, or Babel made syntax.

## What success looks like

- A company defines its brand once and gets branded, deployable artifacts for every framework its teams use — plus a themed Storybook and preview site — in minutes.
- Framework authors ship an official exporter for their library the way they ship a TypeScript types package today.
- "Speaks DTCG + has a transtyle exporter" becomes a checklist item for new UI libraries.
- Migrating a product from framework A to framework B starts with `transtyle import a && transtyle build b` instead of a spreadsheet.

## Non-goals

These are explicit, permanent boundaries. Scope discipline is the project's survival strategy.

1. **We are not a component library.** We generate configuration for other people's components. We ship no runtime UI code and no runtime dependency of any kind.
2. **We are not a design tool.** We do not edit tokens visually. We integrate with tools that do (Figma, Tokens Studio) via importers.
3. **We do not guarantee pixel-perfect equivalence across frameworks.** Translation is lossy by nature; our contract is *fidelity transparency* (the coverage report), not false equivalence.
4. **We do not fork or patch target frameworks.** If Bootstrap cannot express a token, we say so; we don't ship a modified Bootstrap.
5. **We are not an AI theming assistant.** Derivation is deterministic and rule-based. (An AI layer could sit *on top of* the tool and write config; it will never be *inside* the compiler.)

## Long-term direction (beyond v2)

- **Component abstraction layer** (v2, specced in [docs/specs/component-layer.md](docs/specs/component-layer.md)): map semantic component intents (Button, Modal, Combobox) across ecosystems.
- **Bidirectional sync**: importers become good enough that a target's theme edits can be lifted back into the IR with provenance.
- **Registry**: a public index of exporters/importers with compatibility metadata, so `transtyle add <anything>` just works.
- **CI-native workflows**: design-system diffs on pull requests ("this change reduces contrast on `danger` in dark mode; 3 targets affected").
