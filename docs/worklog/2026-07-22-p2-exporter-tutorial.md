# Worklog — P2: "Write your own exporter" tutorial

**Task:** P2 (execution-2026-h2.md). Written against a local path rather than npm since R4 is parked; every other step is unchanged for when it lands.

## The tutorial

[website/src/docs/write-an-exporter.md](../../website/src/docs/write-an-exporter.md) builds a real **Alacritty terminal-theme exporter**: small enough to read in a sitting, and deliberately awkward — a terminal has 16 colours and no radius/spacing/type, so the reader is forced to classify honestly and to emit `dropped` rows. It teaches the grid (`solid` → ANSI normal, `solid-hover` → ANSI bright), `ctx` colour helpers, missing-slot handling as data rather than a crash, and the conformance kit as the finish line. Target chosen so it can't pre-empt anything on the official roadmap.

## Acceptance, met literally

The tutorial's code blocks were **extracted verbatim from the markdown** by script, assembled as a reader would (§2 table + §3 emit → `src/index.js`, §4 → the test, the JSON block → `package.json`), installed in a fresh project **outside the monorepo**, and:

- passed **all 9 conformance checks**;
- built a real theme through the CLI — `55% native · 23% approximated · 18% dropped · 5% unsupported`;
- touched no core code.

## Blocker found and fixed: third-party exporters could not be loaded at all

Following my own step 5 failed. `loadExporter` did a bare `import(pkg)`, which resolves relative to **the CLI's own module**, not the user's project — the error even said `imported from …/packages/cli/src/main.js`. So an exporter that is correct, conformance-passing, and properly installed in a consumer project is unloadable whenever the CLI isn't inside that project's `node_modules` (global install, monorepo checkout, hoisted binary).

**This would have stopped [P3](../plan/execution-2026-h2.md)'s third-party pilot on day one** — the exact scenario P3 exists to test. Fixed with `makeLoadExporter(cwd)`: resolve **from the user's project first** (via `createRequire` rooted at the project), then fall back to the CLI's own install, with an error listing both attempts and the `npm install` hint. Project-first also lets a project deliberately pin its own fork of an official exporter. All call sites (`build`/`check`, `explain`, both sides of `diff`) now pass the project cwd.

## Correction carried back to B7

While assembling this, `check:color` failed intermittently — it used `Math.random()`, making it flaky _and_ blind: my B7 claim that hex "round-trips losslessly, 0 delta over 4096 samples" was luck. An exhaustive 16,777,216-value sweep shows **1580 values (0.0094%) drift by exactly 1/255**, all near-black. The check is now deterministic (fixed 4-step grid), asserts the true bound plus exact round-trips for colours anyone authors, and the behaviour is documented on `formatHex`. The B7 worklog carries the correction. Build determinism is unaffected.
