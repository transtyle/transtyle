# A benchmark and a budget for large token sets

Issue [#97](https://github.com/transtyle/transtyle/issues/97). No example has more than a few hundred tokens, and nothing measured the pipeline beyond that, so a regression from 200 ms to 20 s would have shipped unnoticed. The numbers and what they mean are in [docs/findings/performance.md](../findings/performance.md); this entry is what changed and why.

## What shipped

- `scripts/lib/large-ds.mjs`: a deterministic generator of Acme-shaped projects of any size (tokens, base layers, one/two/four mode combinations, two alias chains of any length, custom archetyped roles), written to a temp directory.
- `npm run bench` (`scripts/bench.mjs`): nine cases from 1k to 100k tokens, each in its own process, printing the median compile time, the time of each stage (LOAD, NORMALIZE, DERIVE, ALIASES, CHECKS) and of each exporter, and the peak RSS.
- `npm run check:perf` (`scripts/check-perf.mjs`): the 10k-token, four-combination project with two 10,000-link chains compiles clean with every exporter, both chains resolve, the median compile stays under 10 s and under 40 times the 1k case, and peak RSS under 1 GB. A CI step of its own, not in `check:all`.
- `check-cli`: a 10,000-link chain checks clean through the CLI, and the same chain closed into a loop is one `TST1104` listing every link, with no `TST1105`. This keeps the overflow under `check:all`, which `check:perf` is not.
- Six fixes, five in `@transtyle/core` and one in `@transtyle/exporter-mantine` (patch changeset), found by profiling the benchmark:
  1. `resolveEntry()`, `resolvePending()` and `resolveIfReady()` walk an alias chain in a loop instead of recursing per link: a chain of ~4,500 links overflowed the stack (`Maximum call stack size exceeded`, exit 2, no code).
  2. `aliasRoot()` takes a memo, and `checkOutOfGamut()` and `nearClusters()` pass one per map: the out-of-sRGB check walked each chain again from every token on it (54 s for two 10,000-link chains).
  3. A member of an alias loop already reported as itself is not walked again: a 10,000-link loop took 188 s of CPU through `transtyle check`, now 0.7 s.
  4. `TST1115`'s duplicate grouping keys exact values and buckets colours on a lightness × chroma grid instead of scanning every group per token (~120 ms of a 10k compile, now ~6 ms).
  5. `@transtyle/exporter-mantine`: `collapseVariable()` looks a variable's palette up by its hyphen positions instead of sorting and trying every palette name for every variable (500 custom roles: 1.5 s, now 75 ms).
  6. `deprecationsReached()` (#188, merged while this branch was in progress) walks with an explicit stack instead of recursing per hop, and its callers skip it when nothing is deprecated: the new `check-cli` case caught it overflowing right after a rebase.

## How the fixes were checked

The old and new cores compiled sixteen alias edge cases (loops, tails into loops, self-aliases, dangling and unparseable chain ends, ends DERIVE fills, composite members on loops and on missing tokens, a loop only in dark), the four examples, the four Tokens Studio fixtures (expressions included) and three generated projects, and every diagnostic, every resolved entry (value, provenance, pending flags) and every emitted file came out identical. The duplicate grouping was compared with the old scan on 300 generated sets of near-equal colours, achromatic greys, hues across 0°/360° and alpha, and Mantine's new `collapseVariable()` with the old one on 100,000 generated names, palette lists (hyphenated ones included) and suffix lists, and the new `deprecationsReached()` with the old one on 25,000 generated alias graphs. `check:perf` was run against each fix reverted: the recursive resolver fails it on the stack overflow, the unmemoized `aliasRoot()` on both time budgets after one compile.

## Deviations from the issue and its refinement

- **`check:perf` is not in `check:all`.** The issue asked for it there with a generous ceiling. A timing check can fail for a reason that is not the tree (a laptop on battery, a loaded runner), and `check:all` is the suite that must be red only for the tree, so CI runs it as its own step and the alias-chain half that does not depend on the clock went into `check-cli`, which `check:all` runs.
- **The budget is a ratio as well as a ceiling.** The 1k case compiled alongside gives a machine-independent measure: linear growth keeps 10k/1k near 10, a quadratic stage puts it far above 40 on any hardware. The absolute ceiling (10 s) is wider than the refinement's "about ten times the first CI measurement": it was set before any CI run, and can tighten once CI has measured it.
- **The memory ceiling is 1 GB, not 512 MB.** The whole check (both sizes, twelve compiles, eleven exporters) peaked at 380–690 MB on a loaded machine; 512 MB would have been inside the noise, and garbage collection timing varies with the machine.
- **Eleven exporters, not eight**, since Mantine, Chakra and MUI shipped after the issue was written.
- **Four more fixes than the refinement planned** (3 to 6 above): the loop walk, the duplicate grouping, Mantine's palette matching and the deprecation walk. All came out of profiling the benchmark, all are local, and all keep every output identical.

## Not done

- Timings are not under `<!-- measured: -->` markers: they are not reproducible across machines.
- The reads recorder (`packages/core/src/reads.js`, which copies every mode map for every target) is now the largest single cost, about a third of a 10k compile. It is linear, recent, and has its own contract, so it is a separate issue ([#203](https://github.com/transtyle/transtyle/issues/203)).
- The remaining linear costs (the location scanner in LOAD, the scale-order check's map scan, css-variables emitting every semantic token) are listed in the findings as the cheapest wins if a real design system ever needs them.
