# Strategic review — 2026-07-22

Commissioned as a three-part exercise: (1) challenge the project's core assumptions, (2) produce a precise, model-assigned execution roadmap for the next six months, (3) plan the documentation overhaul. Each part was saved and committed independently so the review survives partial completion.

**A note on the brief itself.** The commissioning brief described Transtyle as "a design token meta-language enabling translation across design systems via themes/presets," validated by "Gov.UK, Spectrum." That framing lags the repository by several weeks: Transtyle is positioned as a *compiler* (importers → IR → exporters, per [VISION.md](../../VISION.md)), "preset" is PrimeNG's vocabulary rather than ours, and the real-DS validations are **GOV.UK and Carbon** ([docs/findings/](../findings/)) — Spectrum was a *study subject* in the component-tier work, never an adoption. This drift is itself a finding: the strategic narrative circulating outside the repo is stale relative to what's built, which reinforces W3 below (the bottleneck is distribution and legibility, not engineering).

---

## Part 1 — Critical assessment

The brief posed five challenge questions. Unusually, the repo has already run real experiments bearing on most of them; this section answers each from evidence, then distills the three assumptions most likely to be wrong.

### Q1. Is agnosticism actually achievable, or does it paper over irreconcilable paradigm differences?

**Achievable at the semantic-token tier — proven; achieved *by refusing structure*, which bounds precision.** Two independent cross-ecosystem studies both returned "add nothing to the catalog": proposal 0001's 14-ecosystem role-grid study, and the C1 six-system component-tier study ([component-tier-study.md](../findings/component-tier-study.md)), which faced three *mutually incompatible* component-tier architectures (grouped objects / flat vocabulary / per-component namespaces) and concluded the agnostic answer was to keep the catalog a flat meta-language of meanings and let each exporter shape it. Radix (T9) and GOV.UK/Carbon (T11) then compiled with **zero catalog amendments**.

So the paradigm differences are real and irreconcilable *at the structural level* — and the design already concedes this. Agnosticism is purchased by (a) keeping the shared vocabulary small and meaning-shaped, (b) making everything structural exporter-private, and (c) declaring lossiness openly (the coverage report; VISION non-goal #3). The honest corollary: **the catalog's expressiveness is the product's ceiling**, and cracks are visible where a source system's scale doesn't fit — GOV.UK's responsive type scale was deliberately left unbound rather than distorted ([govuk-adoption.md](../findings/govuk-adoption.md)). That was the right call for a demo; a production adopter would call it a gap.

### Q2. Are we solving the right problem — token mapping, or design culture translation?

**Both, and the architecture already splits them correctly — but the docs under-sell the split.** The GOV.UK adoption is the cleanest evidence: mechanical mapping covered most slots 1:1, and the residue was *judgment calls* the compiler correctly refused to make (`neutral.solid` had two defensible bindings; four roles were left to derivation because GOV.UK "hasn't made a choice at this granularity"). Culture translation lives in the human-authored binding layer; the compiler's job is to make the mechanical 80% free and the judgmental 20% **explicit, small, and auditable** (`transtyle explain`, provenance, coverage). That is a right-problem framing — "trust is the product" — but it is currently legible only to someone who reads findings documents. It should be the headline pitch, not an internal insight.

### Q3. Does the plugin-based model scale? Should external teams create mappers directly?

**This is the single most untested assumption in the project — see W1.** All eight exporters were written inside this repo by the same effort that wrote the core; the plugin API has therefore never been exercised by anyone who couldn't read the compiler's source or fix the contract mid-flight. The v1.0 exit criterion ("a third party has shipped a working exporter without touching core, using only public docs") is *exactly right* — but nothing published on npm, no plugin conformance kit (promised in the plugin docs, doesn't exist — [audit A3](../audit-2026-07.md)), and no third-party tutorial means the criterion currently has no path to being met organically. "External teams create mappers directly" is not an alternative to the plugin model — it *is* the plugin model; the question is whether they can do it without us, and today the answer is demonstrably no.

### Q4. Are GOV.UK and Carbon truly validating the meta-language, or just proving specific cases?

**They validate the binding-layer pattern on best-case inputs; they do not validate the median case — see W2.** Both are publicly documented, token-mature, semantically disciplined systems — the easiest real systems that exist. Both adoptions were performed by the project itself (T11's practitioner sign-off is still pending), single-mode for GOV.UK, type scale unbound. What they *do* prove is non-trivial: the catalog generalizes past the systems it was designed against, with zero amendments. What they *don't* prove: that a messy enterprise DS — values scattered across Figma styles and Sass spaghetti, no semantic tier, conflicting sources of truth — can get to a binding layer at acceptable cost. That's the actual median customer, and no experiment has touched it.

### Q5. Who is the actual user: theme adopters, or mapper creators?

**Adopters first, by the project's own revealed evidence; creators are the Phase-2 flywheel, currently population zero.** The backlog already discovered this empirically: B4 ("adopt an existing design system" — "probably the #1 missing doc"; "the primary real-world user *already has* a design system") was written, shipped, and slotted second in the Start-here nav. The vision needs both sides eventually — framework authors shipping exporters is what makes the ecosystem compound — but sequencing matters: a two-sided market bootstraps from the side that gets value unilaterally, and that's the team with one DS and N target frameworks. Every near-term investment should serve that user; mapper-creator investment should be concentrated into making *one* pilot succeed (Q3), not into speculative breadth.

### The three assumptions most likely to be wrong

**W1 — "The exporter ecosystem will materialize from good architecture and good docs."**
Zero third-party exporters, zero npm packages published, no conformance kit, no tutorial; every data point about plugin-API usability comes from its own authors. *Implication:* the v1.0 exit criterion slips indefinitely if treated as an organic milestone. Treat the first third-party exporter as a **recruited, hand-held pilot** (a named partner, direct support, the kit built *for* them) and treat everything they stumble on as a release-blocking bug in docs or API. Roadmap: tasks R4–R6, P1–P3.

**W2 — "GOV.UK/Carbon generalize to real-world adoption."**
Both validations are best-case inputs, self-performed, and (for T11) still awaiting the practitioner sign-off the exit criterion requires. The unproven step is *upstream* of Transtyle: getting a messy, undocumented DS into DTCG + binding form at all. *Implication:* importers and the adoption pathway are not Phase-3 conveniences — they are the wedge for the median user. A deliberate "hostile adoption" experiment (a real DS with *no* published tokens) would tell us more than an eighth and ninth exporter. Roadmap: tasks P4, I1–I2.

**W3 — "The bottleneck is mapping precision / meta-language expressiveness."**
Three consecutive expressiveness experiments (proposal 0001, C1, T9/T11) all concluded the catalog is sufficient and should *not* grow. Meanwhile: nothing on npm, website undeployed, domains unregistered, T11 unsigned, Phase-1 freeze undeclared. The engineering is ahead of the product's ability to be found, trusted, or used. *Implication:* further mapping-edge-case work has sharply diminishing returns; the next six months should be weighted toward **distribution and trust surfaces** (publish, deploy, playground, diff) over catalog or exporter breadth. Roadmap: Phase A, tasks R1–R6, P2.

**Verdict on the meta-language itself:** the core bet survives scrutiny well — it has been genuinely stress-tested and held, and its discipline (refuse structure, declare lossiness, exporter-private by default) is the reason. The at-risk assumptions are all *go-to-market* assumptions wearing engineering clothes.

---

## Part 2 — Execution roadmap (next 6 months)

Priorities follow directly from Part 1: Phase A converts finished engineering into a released, findable product (W3); Phase B builds the trust surfaces and runs the two experiments that test W1 and W2; Phase C opens the importer side. Tasks are granular enough for direct handoff; each names a model assignment with rationale (the standing convention from [component-tier.md](component-tier.md), now with Fable in the palette: **Sonnet** for well-specified implementation, **Opus** for architectural judgment, **Fable** for the few open-ended, high-ambiguity calls with long-term consequences). Human-only steps are marked — a model can prepare them but not perform them.

### Phase A — Release the thing that exists (month 1)

```
R1 — T11 practitioner sign-off & Phase 1 exit
Model: human (maintainer) · Sonnet for prep
Why: the exit criterion requires the maintainer's own practitioner pass, by its own wording
Input: docs/findings/t11-review-checklist.md; the 8 GOV.UK/Carbon demo projects
Output: signed checklist; ROADMAP T11 flipped to [x]; Phase 1 declared exited
Est. tokens: 2K–5K (prep only)
Blocks: R2 (freeze should follow, not precede, the last Phase-1 evidence)
```

```
R2 — Formal freeze declaration: IR spec v0 + plugin API v0
Model: Opus
Why: a freeze is a promise audit — every guarantee in ir.md/plugins.md must be checked
     against what the engine actually does before it becomes a compatibility contract.
     Judgment about what to *exclude* from the freeze matters as much as the text.
Input: docs/architecture/ir.md, plugins.md, versioning.md; ADR-0010; T5 ground-truth scripts
Output: freeze ADR (no. 0011); stability tables in both specs marked frozen;
        ROADMAP Phase-0 tail closed
Est. tokens: 15K–25K
Blocks: R4 (publishing re-arms the freeze per ADR-0010 — do not publish unfrozen)
```

```
R3 — Real JSON schemas + strict options validation (audit A7 + A8)
Model: Sonnet
Why: mechanical schema generation from existing specs; clear acceptance (editor
     autocomplete works, unknown options error as the spec already promises)
Input: docs/specs/configuration.md; loader source; the fictional $schema URLs
Output: served schemas under website/public/schemas/; loader validates config +
        exporter options + transtyle manifest key; tests
Est. tokens: 20K–30K
Blocks: R4 (schema URLs must be real before packages advertise them)
```

```
R4 — npm publication of @transtyle/* (audit A5 + G3)
Model: Sonnet
Why: release mechanics — changesets/versioning, provenance attestations, dry-run,
     publish order for 10 workspace packages; well-trodden ground
Input: R2, R3 done; package manifests; CHANGELOG.md
Output: all packages live on npm with provenance; release-process doc; git tags
Est. tokens: 10K–20K
Blocks: P2, P3, P5 (nothing third-party can exist before install works);
        unblocks create-transtyle (backlog B2)
```

```
R5 — Website deployed on a real domain (audit F1)
Model: human (domain purchase) · Sonnet (deploy pipeline)
Why: llms.txt and schema URLs already reference transtyle.dev; a product that
     cannot be found cannot recruit a pilot partner (W1) — cheapest task, gates most
Input: website/ (Astro, builds today); registrar access
Output: live site + CI deploy on push; sitemap; the naming tail (domains) closed
Est. tokens: 5K–10K
Blocks: P3 recruitment credibility; Part 3 docs work lands somewhere visible
```

### Phase B — Trust surfaces & the two experiments (months 2–4)

```
P1 — Plugin conformance kit
Model: Opus
Why: the kit *is* the plugin contract made executable — deciding what conformance
     means (determinism, coverage honesty, mode handling, manifest ranges) is
     architecture, not test-writing; it encodes the API semantics third parties rely on
Input: docs/architecture/plugins.md; the 8 in-repo exporters as corpus
Output: @transtyle/plugin-kit: conformance suite any exporter repo can run;
        all 8 official exporters pass it in CI
Est. tokens: 30K–45K
Blocks: P2, P3
```

```
P2 — "Write your own exporter" tutorial
Model: Sonnet
Why: documentation drafting against a now-executable contract (P1); the css-variables
     exporter already exists as the designated reference implementation
Input: P1 kit; exporter-css-variables source; plugin docs
Output: website tutorial: zero → published third-party exporter, kit-verified,
        without touching core
Est. tokens: 12K–18K
Blocks: P3
```

```
P3 — Recruited third-party exporter pilot  ← tests W1
Model: human (recruiting) · Fable (feedback triage & API-change decisions)
Why: W1 says this milestone will not happen organically — pick a partner (Mantine or
     Chakra per backlog B3: object-emitter, semantic-token-native, strong adoption),
     support them directly, and treat every stumble as a release-blocking docs/API bug.
     Triage of what their friction *means* for the API is the highest-judgment call in
     this roadmap — wrong calls here freeze mistakes into the v1 plugin contract.
Input: P1, P2, R4; a named partner
Output: one exporter shipped outside this repo using only public docs;
        v1.0 exit criterion met or a precise list of why not
Est. tokens: 20K–40K (support, spread over weeks)
Blocks: plugin API v1 declaration (Phase 2 exit)
```

```
P4 — Hostile-adoption experiment: a real DS with no published tokens  ← tests W2
Model: Fable
Why: the median-customer simulation — extract a DS from a live product's CSS/Sass
     (no token files, no semantic tier), get it to a binding layer, and *measure the
     cost honestly*. Open-ended, adversarial, and the verdict ("the wedge works" /
     "importers must come first") redirects Phase C. Same shape as C1: highest
     ambiguity, judgment with long-term consequences.
Input: a candidate DS (an OSS product with a hand-rolled design language, not a
       design system); the adopt-existing playbook
Output: docs/findings/hostile-adoption.md — cost ledger, where the playbook broke,
        verdict on W2; example promoted to examples/ only if it earns it
Est. tokens: 40K–60K
Blocks: Phase C prioritization (I1 vs I2 order is decided by this finding)
```

```
P5 — Browser playground (audit E1)
Model: Sonnet
Why: core is zero-dep ESM and runs client-side unchanged — this is composition, not
     invention; the audit already calls it the best wow-per-effort item available
Input: R4 (published packages), R5 (live site); @transtyle/core
Output: website playground: paste tokens → live shadcn/css-variables output +
        coverage bar + explain-on-hover; doubles as report.json viewer (audit E4)
Est. tokens: 25K–40K
Blocks: nothing; multiplies everything (marketing surface for P3 recruitment)
```

```
P6 — transtyle diff (semantic DS diff, per-target impact)
Model: Opus (design + review) · Sonnet (implementation against the written spec)
Why: the diff *semantics* (what is a breaking design change? how does impact
     propagate through derivation provenance?) are novel design; the CLI plumbing
     is not. Split explicitly: Opus writes docs/specs/diff.md, Sonnet implements.
Input: IR + provenance model; report.json shape
Output: transtyle diff <ref> with per-target impact summary; the CI story for
        design-system PRs (audit B3, Phase 2 ledger)
Est. tokens: 15K–25K (spec) + 25K–35K (impl)
Blocks: E5 (GitHub Action for consumer repos — natural follow-on, not scheduled here)
```

### Phase C — The importer side (months 4–6, order set by P4's verdict)

```
I1 — Tailwind config importer
Model: Sonnet
Why: cheapest first importer (audit D1); tailwind config → option/semantic binding is
     mostly mechanical once the mapping table is written; huge demo value
Input: ADR-0008; a corpus of real tailwind.config files
Output: @transtyle/importer-tailwind + round-trip coverage report; demo:
        tailwind.config → shadcn + ECharts themes
Est. tokens: 30K–40K
Blocks: the "ecosystem translation" story (Phase 3) getting its first real leg
```

```
I2 — Figma variables importer
Model: Sonnet · Opus for the mode-mapping design decision
Why: implementation is JSON transformation (Sonnet); the one hard call is mapping
     Figma's mode model onto IR mode dimensions — that decision is small but
     architectural, worth an Opus pass before code
Input: Figma variables JSON export format; ADR-0008; T8 multi-dimension modes
Output: @transtyle/importer-figma; the designer-side on-ramp documented
Est. tokens: 30K–45K
Blocks: the designer entry path; pairs with P4's findings on messy sources
```

```
I3 — Watch mode + CI recipes (audit B10 + E5-lite)
Model: Sonnet
Why: small DX wins batched together; no design content
Input: CLI source; P6's diff output
Output: build --watch; documented GitHub Actions recipe running check + diff on PRs
Est. tokens: 10K–15K
Blocks: nothing — schedule into gaps
```

### Consolidated model-assignment table

| Task | Model | One-line rationale |
|---|---|---|
| R1 sign-off | **human** (Sonnet prep) | Exit criterion demands the maintainer's own pass |
| R2 freeze declaration | **Opus** | Promise audit against engine reality; exclusion judgment |
| R3 schemas + validation | **Sonnet** | Mechanical generation from existing specs |
| R4 npm publication | **Sonnet** | Release mechanics, well-trodden |
| R5 site deploy | **human + Sonnet** | Domain purchase; then routine pipeline |
| P1 conformance kit | **Opus** | The plugin contract made executable — architecture |
| P2 exporter tutorial | **Sonnet** | Docs drafting against an executable contract |
| P3 third-party pilot | **human + Fable** | Recruiting; then API-change triage with v1-contract stakes |
| P4 hostile adoption | **Fable** | Open-ended adversarial experiment; verdict redirects Phase C |
| P5 playground | **Sonnet** | Composition of existing zero-dep pieces |
| P6 diff | **Opus spec → Sonnet impl** | Novel semantics; routine plumbing |
| I1 Tailwind importer | **Sonnet** | Mechanical once mapping table exists |
| I2 Figma importer | **Sonnet** (Opus for mode mapping) | JSON transform + one architectural call |
| I3 watch/CI recipes | **Sonnet** | Batched DX small-wins |

### Prioritized backlog (the six months at a glance)

| Month | Focus | Tasks |
|---|---|---|
| 1 | Release readiness | R1 → R2 → R3 → R4 → R5 |
| 2 | Plugin contract | P1 → P2; recruit P3 partner; start P5 |
| 3 | The two experiments | P3 running; P4; P5 ships |
| 4 | Trust tooling | P6 (spec then impl); P3 concludes → plugin API v1 call |
| 5 | Importers | I1 (or I2 first, per P4's verdict) |
| 6 | Importers + DX | I2 (or I1); I3; regroup against W1/W2 verdicts |

**Explicitly not scheduled** (consistent with Part 1): new exporters beyond the pilot's (breadth adds no learning until W1/W2 resolve); catalog growth (three studies say no); MUI/Ant (after object-emitter pattern proven by the pilot); everything in ROADMAP's "explicitly cut" list stays cut.

---

*Part 3 follows in a subsequent commit.*
