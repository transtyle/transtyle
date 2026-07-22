# Worklog — D2: the beginner path

**Task:** D2 (docs/plan/execution-2026-h2.md). Three progressive pages in a new "Learn" nav section, between Start here and Concepts; adopt-existing keeps its Start-here slot per B4.

- **What is a design token?** — for designers/DS leads. Zero code blocks (acceptance met literally). Value-names vs meaning-names, the leverage argument, modes, and the translation problem — with a dialect table whose rows are verified against the exporters' own mapping tables (`elevation.1.surface` → shadcn `--card` / Bootstrap `$body-tertiary-bg` / daisyUI `--color-base-200`).
- **How Transtyle works** — the mental model: exactly one diagram (the write→compile→ship `.schema`), zero code blocks. Pivot language, derivation (deterministic; authored wins), explainability, the four honesty grades, and the deliberate non-goals.
- **Your first build** — executed against `examples/acme` before writing (acceptance): the coverage line (42% native · 53% derived · 3% approximated · 3% dropped), the provenance-commented CSS head, the full `explain primary.tint` chain, and three real `report.json` entries (`--accent` derived, `--input` approximated, density-mode dropped) are all genuine command output.

**Drift fixed en route:** the homepage hero terminal and coverage bar claimed 43/54/3 — the real Acme shadcn numbers are 42/53/3/3; corrected. The dead-vocabulary guard caught "text-on-blue" in my own draft prose (banned pre-revision slot pattern) — rephrased; the guard works on new content too.

**Verified:** 26 pages build; both guards green; page 1 and 2 confirmed zero `<pre>` in rendered HTML; pager threads Start here → Learn → Concepts.
