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

*Parts 2 and 3 follow in subsequent commits.*
