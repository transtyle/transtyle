# Cap the heap in check:perf

`check:perf` started failing its 1,024 MB memory budget on `main` and on unrelated PRs, then passed on a re-run. The cause was the budget, not the tree: V8 collects lazily when its old space may grow, so the same code peaked anywhere between 640 and 1,200 MB, while the live heap stays under about 320 MB (the check passes with `--max-old-space-size=320` and runs out of memory at 256). A limit inside a spread of that size fails at random.

## What shipped

- `scripts/check-perf.mjs` re-spawns itself with `--max-old-space-size=512` unless the flag is already set, so `npm run check:perf` is the same locally and in CI with no change to the workflow. `MAX_RSS_MB` goes from 1,024 to 768.
- On `main` before #233: 1,100, 1,144 and 1,149 MB, all over the old budget. On `main` with #233, uncapped: 834, 953 and 903 MB. Capped: 492 to 576 MB over five runs.
- A real leak now ends in an out-of-memory crash (non-zero exit) instead of a drift past the limit.
- `docs/findings/performance.md`, `CONTRIBUTING.md` and `scripts/README.md` carry the new description of the memory budget.

## Decisions

- **Re-spawn rather than `NODE_OPTIONS` in the CI step.** The check then behaves the same on a laptop, and the cap lives next to the budget it belongs to. The cost is one extra process start.
- **768 MB rather than a tighter limit.** The capped peak is 490 to 580 MB, so 768 leaves room for a runner that differs while still being well under the old uncapped numbers.
- This does not make the compile cheaper. That was [#233](https://github.com/transtyle/transtyle/pull/233), which landed first and brought the uncapped peak down but left it inside the noise of the old budget.

No package changes, so no changeset.
