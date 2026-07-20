# Backlog — captured ideas, not yet scheduled

Raw product ideas with initial analysis. Graduating an item means: an ADR if it changes design, a ROADMAP phase slot, and the [CONTRIBUTING sync rule](../CONTRIBUTING.md) applied. Source: maintainer review sessions (2026-07-18).

## B1 — Editorial policy: implemented-only docs

**Problem.** Unimplemented targets (Bootstrap, Storybook) appear in user-facing docs; even with "specced" qualifiers, naming them risks reading as availability.

**Policy (adopted now, added to CONTRIBUTING):** user-facing docs (website, README) may only name an unimplemented capability inside an explicit status construct — the roadmap ledger, a "specced" chip/label, or a "not yet implemented" sentence. Never in feature prose. Engineering specs in `docs/` are exempt (they *are* the plan, clearly framed as such). Audit result at time of writing: landing chips carry "· specced", roadmap ledger separates implemented/specced, hero says "next" — compliant, but the rule now exists so it stays true.

## B2 — Starter template ("theme kit")

**Idea.** A downloadable template repo: paste your design tokens in, `npm run build`, and get per-technology directories each containing (a) the ready-to-use theme, (b) that technology's docs/showcase with the theme applied, (c) a small demo app — deliberately the *same* app across technologies — to eyeball the rendering.

**Analysis.** High-value onboarding; mostly composition of existing pieces. The "same fake app everywhere" is the strongest part: it makes cross-target fidelity *visible* and doubles as our ground-truth test fixture (one app spec, N implementations — this is also how the future preview site should render component samples). Caution from [ADR-0007](adr/0007-doc-generation-scope.md): "docs of the technology with theme applied" must be the Tier-1/2 approach (our preview + the target's published assets), not upstream doc rebuilds.

**Shape.** `create-transtyle` npm initializer + `templates/theme-kit/` in-repo; the demo app is a spec (`docs/specs/demo-app.md`: header, buttons in all roles, form, card, table, modal, chart) implemented once per supported target. Depends on: npm publication (Phase 1).

**Status 2026-07-20:** the demo-app half shipped as **real npm projects** — [docs/specs/demo-app.md](specs/demo-app.md) + five projects per example under `examples/<example>/demo/` (Bootstrap Sass-path Vite app, shadcn/ui React app with registry components, daisyUI Tailwind app, an ECharts dashboard, a minimal Storybook), each consuming only the transtyle-built `dist/`. Shipping them forced the Bootstrap and Storybook exporters forward from Phase 1 (fixtures became their acceptance tests). The `create-transtyle` template packaging remains here, still gated on npm publication.

## B3 — Target priority list

**Decision needed:** ordered exporter roadmap. Proposal, ranked by theming-surface fit (CSS-variable-native first — cheapest, highest fidelity), adoption, and what each teaches the IR:

1. ~~shadcn/ui~~, ~~Apache ECharts~~, ~~daisyUI~~, ~~Bootstrap~~, ~~Storybook~~ — shipped (the last two 2026-07-20, pulled forward for B2's demo projects).
4. **Radix Themes** — CSS-var native, principled scale system; tests our option-scale generation (their 12-step scales).
6. **Mantine** — CSS vars + TS theme object hybrid, strong adoption.
7. **Chakra UI** — semantic-token native (their `semanticTokens` maps almost 1:1 to our catalog).
8. **MUI** — JS theme object, enormous adoption, but deepest API surface; after the object-emitters (6–7) prove the pattern.
9. **Ant Design** — design-token API since v5; validates non-Western-ecosystem reach.
10. **Tailwind (bare `@theme`)** and **css-variables** — generic substrate exporters; css-variables should arrive earlier as the plugin-API conformance fixture (Phase 1 commitment).

## B4 — "Adopt an existing design system" guide (probably the #1 missing doc)

**Problem.** The primary real-world user *already has* a design system with its own names, and our docs teach greenfield authoring first. The binding-layer pattern exists (Cathode) but is framed as an exotic stunt, not as **the main workflow**.

**Fix.** A dedicated website guide, step-shaped: 1) dump your existing palette/values into `option.*` verbatim (no renaming); 2) express your existing semantics as custom semantic tokens with *your* names; 3) bind catalog slots to them with one-line aliases; 4) build, read the coverage report to see what derivation filled; 5) tighten with `derivation.require` once trust is earned. Plus a worked before/after with a realistic corporate DS (not a CRT). Candidate title: "You already have a design system". Should become the second item in the Start-here nav.

## B5 — Document "the Transtyle language" as a first-class reference

**Problem.** The three tiers, the semantic catalog, and — crucially — the *translation semantics* ("my DS has `primary`, `accent`, `whatever` — how does that plug into other libraries' semantics?") are scattered across concepts/authoring/exporter pages. There is no single page that presents the catalog as what it is: the **interlingua** — the pivot language every source maps into and every target maps out of, with manual mapping (aliases) and automatic mapping (derivation) as the two entry paths, and per-target mapping tables as the exit paths.

**Fix.** A reference page ("The Transtyle language") containing: the full catalog as a table (every slot, type, scale, derivation rule, which shipped exporters consume it); the name-collision warning generalized (shadcn's "secondary" ≠ your "secondary" — same word, different meanings across ecosystems, which is *why* the pivot language exists); and an honest statement of expressiveness limits (what the catalog cannot yet say, and how `unsupported` coverage data drives catalog growth). B4 and B5 cross-link: B4 is the tutorial, B5 the reference.

## Suggested order

B1 done · **B4 done** (`website/src/docs/adopt-existing.md`) · **B5 done** (`website/src/docs/language.md`) · B3 decision folds into ROADMAP (DaisyUI proposed next) · B2 after npm publication.
