# Findings: the compiler at scale

Issue [#97](https://github.com/transtyle/transtyle/issues/97). Every example has tens of tokens; enterprise design systems have thousands (Carbon's full set, multi-brand overlays, per-component vocabularies). Nothing measured what happens in between, so a regression from 200 ms to 20 s would have shipped unnoticed. This page records what the pipeline costs from 1,000 to 100,000 tokens, the defects the first measurements found, and the budget that now guards it.

## How it is measured

`npm run bench` ([scripts/bench.mjs](../../scripts/bench.mjs)) compiles synthetic projects from [scripts/lib/large-ds.mjs](../../scripts/lib/large-ds.mjs): Acme-shaped token files, 45% option colours, 10% option dimensions, 30% semantic colour aliases (each with a dark value in a mode-scoped layer), 5% semantic dimensions (each with a compact value), 10% component aliases, spread over N base layers, plus two alias chains of D links (one ending on an option colour, one on a slot DERIVE fills) and optionally custom archetyped roles. The generator has no randomness, so two runs compile byte-identical projects. Each case runs in its own process, so peak RSS is that case's own; the times are the median of five compiles after a warm-up. `compile` is `compile({ emit: false })` with all eleven official exporters, which is what `transtyle check` runs; the stage columns come from a second run of the same stage functions in `compile()`'s order, the exporter column times each `emit()` inside the compile, and **other** is what neither covers: mostly the recording of what each exporter reads (`packages/core/src/reads.js`) and the per-target reports.

Timings are not reproducible across machines, so nothing here carries a `<!-- measured: -->` marker: the guard is [`check:perf`](#the-budget), not this page.

## The run

2026-10-09, `main` at c2f8cfb plus the fixes below, Apple M4 Pro (14 cores), Node 23.1. The machine was shared with other jobs during the run (load average around 30), so absolute times are inflated two to five times against an idle machine and single cells are noisy (the 1k / 20 / 4 row ran slower than in the previous run, 54 ms); the shape of the table is what to read. Case: tokens / base layers / mode combinations / chain links.

| Case                          | compile, 11 targets | LOAD | NORMALIZE | DERIVE | ALIASES | CHECKS | exporters | other | peak RSS |
| ----------------------------- | ------------------: | ---: | --------: | -----: | ------: | -----: | --------: | ----: | -------: |
| 1k / 3 / 1 / 10               |                  39 |  6.0 |       4.1 |    0.5 |     0.3 |    3.8 |        21 |   2.7 |   122 MB |
| 1k / 20 / 4 / 10              |                 131 |   34 |        13 |    1.5 |     1.3 |    9.1 |        34 |    39 |   133 MB |
| 10k / 3 / 1 / 10              |                 276 |   44 |        53 |    0.6 |     2.7 |     33 |        53 |    89 |   175 MB |
| 10k / 20 / 4 / 10             |                 705 |  132 |       175 |    1.6 |      12 |     90 |        79 |   214 |   260 MB |
| 10k / 100 / 4 / 10            |                 406 |   86 |        90 |    1.8 |     9.0 |     71 |        60 |    88 |   264 MB |
| 10k / 20 / 4 / 10k            |               1,607 |  264 |       350 |    1.9 |     141 |    341 |       206 |   304 |   493 MB |
| 10k / 20 / 4 / 10 / 500 roles |               1,110 |  109 |       114 |     78 |      33 |    115 |       328 |   333 |   398 MB |
| 50k / 20 / 4 / 10             |               2,188 |  363 |       604 |    2.1 |      52 |    401 |       206 |   561 |   611 MB |
| 100k / 20 / 4 / 10            |               5,700 |  994 |     1,436 |    1.9 |     149 |    822 |       483 | 1,814 |  1047 MB |

Across the day's runs the 10k / 20 / 4 / 10 case took 210–705 ms depending on the load. An earlier measurement on an idle machine, at 69dd3fb with eight exporters and before source locations, the authoring checks and the reads recorder landed, gave 55–70 ms. Compiled back to back under the same load, the core at 69dd3fb was about 1.8 times faster than 3bab610's on that case (before the reads recorder): the checks added in between account for most of it, and all of them are linear.

Exporters, same run (ms):

| Case                          | shadcn | echarts | daisyui | bootstrap | storybook | css-variables | radix | primeng | mantine | chakra | mui |
| ----------------------------- | -----: | ------: | ------: | --------: | --------: | ------------: | ----: | ------: | ------: | -----: | --: |
| 1k / 20 / 4 / 10              |    0.2 |     0.3 |     0.1 |       6.2 |       0.4 |           7.7 |   0.7 |     8.4 |     2.0 |    5.9 | 2.0 |
| 10k / 20 / 4 / 10             |    0.2 |     0.2 |     0.1 |       5.5 |       0.3 |            39 |   0.8 |      17 |     2.7 |     11 | 1.6 |
| 10k / 20 / 4 / 10 / 500 roles |    0.2 |     0.5 |     3.0 |       6.2 |       0.5 |           149 |   0.8 |      16 |      75 |     29 |  48 |
| 100k / 20 / 4 / 10            |    0.3 |     0.3 |     0.2 |       6.3 |       0.4 |           429 |   0.9 |      20 |     2.3 |     21 | 2.5 |

## What the numbers say

- **Growth is linear.** Ten times the tokens costs about seven to ten times the time, from 1k to 100k, and memory grows by about 9 MB per thousand tokens over a ~120 MB floor. Nothing in the pipeline is quadratic in the token count any more (see the defects below).
- **Three stages grow with the token count: LOAD, NORMALIZE and CHECKS.** LOAD parses every file twice, once with `JSON.parse` and once more to record each key's line and column for diagnostics (`packages/core/src/locate.js`, a character scanner). NORMALIZE builds one map per mode combination and resolves every alias in each. CHECKS runs the option hygiene (`TST1114`, `TST1115`), the out-of-sRGB check and the scale-order check over every token of every combination.
- **DERIVE does not grow with tokens.** It fills a fixed catalog, so it stays at 1–3 ms from 1k to 100k tokens. It grows with custom archetyped roles instead (500 roles: about 30–190 ms across runs), and so do the exporters that emit one block per role (css-variables, Mantine, MUI, Chakra).
- **The reads recorder grows with tokens times targets.** `compile()` hands each exporter a recording copy of every mode map so `report.json` can say which slots it read (`packages/core/src/reads.js`): eleven targets × four combinations × every token, copied before each `emit()`, and every key listed again afterwards. It is most of the **other** column, about a third of the 10k / 20 / 4 compile and of the 100k one: the largest single cost left, and linear.
- **One exporter grows with tokens: css-variables**, the only one that emits every `semantic.*` token. Bootstrap, PrimeNG and the rest read catalog slots only and stay flat.
- **Layer count barely matters**: in a quieter run earlier that day the 100-layer case matched the 20-layer one (378 and 382 ms), and here it ran faster; the differences are load.
- **A 10,000-link chain costs about as much as 20,000 more tokens**, which is what it is: 20,000 more aliases.

## Defects found

Every one is invisible at example size, and each is now covered by a check.

1. **An alias chain of about 4,500 links overflowed the stack.** `resolveEntry()` and `resolvePending()` (`packages/core/src/normalize.js`) recursed once per link and copied the path at every hop, so a chain cost O(depth²) and a stack frame per link. `transtyle check` printed `✖ Maximum call stack size exceeded` and exited 2, with no code and no token named (it passed at 4,000 links on Node 23's default stack). Both, and `resolveIfReady()`, now walk the chain in a loop and settle it on the way back, with a `Set` for the path. Values, provenance and diagnostics are identical, including the order of `TST1105` along a broken chain and every `TST1104` message; this was checked by compiling sixteen alias edge cases (loops, tails into loops, self-aliases, dangling and unparseable chain ends, deferred ends, composite members on a loop) and the four examples with the old and the new core and comparing every diagnostic, every resolved entry and every emitted file. Guarded by `check-cli` (a 10,000-link chain checks clean) and `check:perf`.
2. **The out-of-sRGB check walked every chain from every token on it.** `aliasRoot()` (`packages/core/src/authoring.js`) followed a token's chain to its end, and `checkOutOfGamut()` asked it for every aliased token of every combination: two 10,000-link chains in four combinations meant about 400 million steps. Once the overflow was fixed, the 10k / 4-combination project with those two chains compiled in 54 s. `aliasRoot()` now takes a memo that records each walked token's root, so every link is walked once per map: the same project compiles in under a second.
3. **A long alias loop was walked once per member.** Each member of a loop starts its own walk, goes round the whole loop and builds the sorted member set, only for `reportCycle()` to find it already reported. A 10,000-link loop took 188 s of CPU through `transtyle check`. A member of a loop already reported as itself now returns at once: 0.7 s. A chain that runs _into_ a loop is still reported as before, tail included.
4. **Duplicate option values were grouped by a linear scan per token.** `TST1115` compared each option token with every group created so far, quadratic in the number of distinct values: about 120 ms of a 10k compile, more than every other check together. Exact values are now keyed and colours (which match within a tolerance) are bucketed on a grid of lightness and chroma cells, so a colour is compared only with the groups it can match: about 6 ms. Same groups in the same order (checked against the old scan on 300 generated sets of near-equal colours).

5. **The Mantine exporter matched every colour variable against every palette name.** To classify its theming surface it collapses each emitted variable (`--mantine-color-<palette>-<shade>`) to its inventory name, and for each one it sorted all palette names and tried them in turn (`collapseVariable()`, `packages/exporter-mantine/src/surface-coverage.js`). With 500 custom roles that is thousands of variables against 500 palettes: 1.5 s, more than the rest of the compile. It now tries the variable's own hyphen positions, longest first, and looks each prefix up in a set: 75 ms under the same load. Same result on 100,000 generated names, palettes and suffix lists, ambiguous hyphenated palettes included.

6. **The deprecation walk recursed per alias hop.** `deprecationsReached()` (`packages/core/src/metadata.js`, from #188, which landed while this branch was in progress) followed a slot's alias chain by recursion, so the 10,000-link chain overflowed the stack again; the new `check-cli` case caught it right after a rebase. It also ran for every catalog slot of every combination and for every coverage item of every target, each walking the slot's whole chain. It now walks with an explicit stack, in the same order, and its callers skip the walk when the map has no deprecated token at all. Same result on 25,000 generated alias graphs with members, cycles and missing targets.

## Left as it is

- **`TST1104` for a long tail into a loop** prints one cycle per tail token, each with the full tail: the output itself is quadratic in the tail's length. It was the behavior before, nothing realistic has such a tail, and changing what it reports is a diagnostics decision, not a performance fix: [#204](https://github.com/transtyle/transtyle/issues/204).
- **`TST2103` clustering** compares every pair of status roles: quadratic in the number of roles archetyped `status`, about 170 in the 500-role case, which costs a few milliseconds.
- **The reads recorder** (`packages/core/src/reads.js`) copies every mode map for every target; delegating to the original map instead of copying it would remove most of the **other** column. It is a recent feature with its own contract (an exporter must see the same keys, values and map identity), so it is filed separately as [#203](https://github.com/transtyle/transtyle/issues/203).
- **The linear stages** above. If a real design system ever needs it, the cheapest wins are in LOAD (the location scanner compares characters through one-character strings) and in the scale-order check (it scans the whole map once per scale per combination when a scale has no catalog rung authored).

## The budget

`npm run check:perf` ([scripts/check-perf.mjs](../../scripts/check-perf.mjs)) compiles the 10k / 20 / 4 project with two 10,000-link chains, and the same project at 1,000 tokens with 1,000-link chains:

- **deterministic**: zero errors, every target emits, both chain heads resolve in all four combinations to the value at the chain's end;
- **time**: the median compile under 10 s, and at most 40 times the 1,000-token case. Linear growth keeps that ratio near 10; defect 2 put it above 80 even with both sizes quadratic, and the absolute ceiling catches a slowdown that hits both sizes alike;
- **memory**: peak RSS under 1,024 MB, against about 380–690 MB measured for the whole check under load.

Both time budgets sit an order of magnitude above a normal run so a busy runner does not fail them; they were set before any CI measurement, so the first CI runs say how much they can tighten. It is timing all the same, so it is not in `check:all`: CI runs it as its own step in `.github/workflows/ci.yml`, after the checks `check:all` chains. Reverting fix 1 fails it on the stack overflow; reverting fix 2 fails it on both time budgets after a single compile.
