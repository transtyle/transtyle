# The per-target loop stops redoing work for every target

Issue [#203](https://github.com/transtyle/transtyle/issues/203), built on the refinement appended to it. The issue was about the reads recorder copying every mode map for every target. Measuring it again on `main` showed a second, larger cost in the same loop: since [#211](https://github.com/transtyle/transtyle/pull/211), `customTokens()` lists and sorts every custom `semantic.*` path twice per target. Together they doubled the `check:perf` compile and pushed its peak memory over the 1,024 MB budget in about half the runs, locally and in CI. The numbers are in [docs/findings/performance.md](../findings/performance.md), defect 7.

## What shipped

- `packages/core/src/reads.js`: `RecordingMap` still extends `Map` (so `instanceof Map` holds), but it no longer copies its source. `size`, `get`, `has`, `keys`, `entries`, `values`, `forEach` and iteration read the original map, with the same read recording as before; `keys()` hands out the source's own iterator, since listing keys isn't a read. `set`, `delete` and `clear` copy the source on the first write and change the copy, so an exporter that writes to its view still changes neither the IR nor what the next target sees. `reads()` tests only the slots that were looked up against the view's maps, instead of listing every key of every map.
- `packages/core/src/custom.js`: the list behind `customTokens()` is computed once per default mode map, frozen and kept in a `WeakMap` for as long as the map lives. `accountCustomTokens()` reads that list; `customTokens()` returns a copy, so each target's `ctx.customTokens` is still its own array. The cache entry also records the map's size and the design system's role archetypes, which guards against a caller that builds a map by hand and changes it between calls; a normalized IR never changes.
- `scripts/check-cli.mjs`: the recording block now checks that the view is a `Map` whose own storage stays empty, and that `set`, `delete` and `clear` change the view and leave the IR as it was. It also checks that a slot only the view added isn't a read, and that two `customTokens()` calls return separate arrays. Breaking the copy-on-write fails three of them; returning the cached list itself fails the last.
- `docs/findings/performance.md` and `scripts/bench.mjs`: the **other** column is no longer described as mostly the recorder; defect 7 records the fix and the measurements, and the reads recorder leaves "Left as it is".
- Patch changeset for `@transtyle/core`.

## How it was checked

- Every example's compile, dumped before and after (each target's files, coverage, `reads` and custom-vocabulary counts, `consumption()`, `customTokens()` and every diagnostic), is byte-identical on acme, cathode, govuk and carbon.
- `npm run bench`, both trees alternately under the same load (load average 13–17). The 10k / 20 / 4 / 10 compile went from 219 to 155 ms, with **other** from 91 to 14 ms. The 10k-link case went from 903 to 534 ms, the 100k case from 2,249 to 1,553 ms.
- `npm run check:perf`, six runs alternately on each tree: `main` failed five on peak memory (894–1,323 MB, median compile 902 ms in the one run that passed), this branch two (852–1,173 MB, median compile 498–523 ms).

## Deviations from the refinement

- **The memory acceptance isn't met under load.** The refinement's prototype stayed under 1,024 MB in seven runs out of seven. On a machine running other jobs (load average 13–17 on 14 cores), the same change still goes over in about two runs out of six. Peak RSS here is mostly garbage the collector hasn't reclaimed yet, and it depends on how much CPU the collector gets. The compile time acceptance holds (median near 500 ms). Making the memory check itself steady is a separate change to `check:perf`, not to the compiler.
- **The memo is per mode map, not per compile.** The refinement suggested computing the list once per compile or per view. Keying it on the map covers both, since every target of a compile shares the default map and a narrowed view keeps it. It also serves the callers outside `compile()` (`check:doc-numbers`, plugin-kit) without a new parameter.
