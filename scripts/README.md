# The checkers

Thirty scripts, one job each — twenty-six chained by `npm run check:all` and
run individually by CI, plus four that guard a release, a deploy, the history
itself, and the compiler's speed at scale.
Every one exists because something real broke or could have: they are not a
test suite grown for coverage, they are a list of mistakes this project has
already made once.

| Script                        | Guards                                                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `check-sync.mjs`              | Every shipped exporter exists on all five surfaces (code, spec, website, README, examples)                                                                                                                                                 |
| `check-docs.mjs`              | Website structure: nav, links, anchors, CLI commands, diagnostic codes, blog posts, language tables                                                                                                                                        |
| `check-doc-numbers.mjs`       | Every number the docs copy out of a build, re-derived                                                                                                                                                                                      |
| `check-encoding.mjs`          | Tracked text files are clean UTF-8 — no NUL bytes, no BOM                                                                                                                                                                                  |
| `check-color.mjs`             | The colour engine against reference values: parsing (all DTCG spaces), round-trips, contrast, mixing                                                                                                                                       |
| `check-plugins.mjs`           | Every official exporter passes the published plugin conformance suite                                                                                                                                                                      |
| `check-grid.mjs`              | Catalog completeness against `catalog()`, both ways; the frozen Phase 0 values; bound roles get grids                                                                                                                                      |
| `check-fixtures.mjs`          | A fresh build against the Phase 0 acceptance fixtures, key by key                                                                                                                                                                          |
| `check-rem-base.mjs`          | The config-level rem base (`units.remBase`): a custom base reaches ECharts and Storybook, the default is byte-identical, a bad base is `TST1010`                                                                                           |
| `check-determinism.mjs`       | Two builds of every example and of the mode-dimensions fixture, byte-compared                                                                                                                                                              |
| `check-atomic-emit.mjs`       | A failed build leaves every output directory byte-for-byte as it was, with no staging directory left behind                                                                                                                                |
| `check-schemas.mjs`           | Published JSON schemas match their source objects; every config, report and manifest validates                                                                                                                                             |
| `check-cli.mjs`               | `init` / `add` / `build` / `explain` / `diff` / `catalog` / `bind --suggest` / drift golden paths and errors                                                                                                                               |
| `check-explain.mjs`           | `explainToken()` golden paths: authored, aliased and derived slots, plus the walk's edge cases                                                                                                                                             |
| `check-component-tier.mjs`    | The empty tier defaults; an authored tier reaches both targets; a semantic alias into it is `TST1113`                                                                                                                                      |
| `check-tokens-studio.mjs`     | A Tokens Studio export (folder, single file, legacy) compiles byte-identical to its plain DTCG twin                                                                                                                                        |
| `check-bootstrap-surface.mjs` | Bootstrap's checked-in surface inventory against the real `_variables.scss`                                                                                                                                                                |
| `check-coverage-bar.mjs`      | Every inventoried Bootstrap/PrimeNG/Mantine/Chakra slot is accounted for, with a note on every gap                                                                                                                                         |
| `check-gamut-rows.mjs`        | An out-of-gamut primary is `approximated` per variable in all five hex/HSL writers                                                                                                                                                         |
| `check-minimal-ds.mjs`        | Every exporter survives 1-, 2- and 3-token design systems in eight mode shapes, composites and mode subsets; the default text and the neutral swap; every combination of contrast, motion and brand resolves right through the CSS cascade |
| `check-demo-parity.mjs`       | Every example's demo for a given target is the same application                                                                                                                                                                            |
| `check-demos.mjs`             | The published demo grid: described, documented with its port, linked from its exporter page, deployed                                                                                                                                      |
| `gen-figures.mjs --check`     | The blog's figures still match a fresh compile of the examples they were painted from                                                                                                                                                      |
| `gen-matrix.mjs --check`      | The docs' slot × target matrix still matches what each exporter reads                                                                                                                                                                      |
| `gen-catalog-signals.mjs`     | (`--check`) The catalog-signals report matches every exporter's `unsupported` rows, keys registered                                                                                                                                        |
| `check-package-manifests.mjs` | What a published tarball needs and the workspace hides: access, provenance, keywords, `files`, `bin`                                                                                                                                       |
| `check-brand.mjs`             | The logo everywhere: assets current, every surface still carrying it, the site drawing the same glyph                                                                                                                                      |
| `check-release-tag.mjs`       | The dist-tag a release resolves to, and that a stable one can't arm the freeze by reflex                                                                                                                                                   |
| `check-site-links.mjs`        | Every link in the built site sits under the Pages base path                                                                                                                                                                                |
| `check-secrets.mjs`           | No credential or personal data in any blob, commit message or identity, ever                                                                                                                                                               |
| `check-perf.mjs`              | 10,000 tokens, four mode combos, 10,000-link alias chains: compiles clean, in time and in memory                                                                                                                                           |

The last four are not in `check:all`: the first three do not grade a working
tree, and the fourth grades it with a stopwatch.
`check-release-tag` runs in the release workflow: on an ordinary tree it is
_supposed_ to refuse, so chaining it into the everyday suite would make the
suite red for being ordinary. `check-site-links` is a **post-build
assertion** — it is chained to `site:build` as `postsite:build`, so it runs
on every site build, local and CI, without anyone opting in.

That makes `check-site-links` the one deliberate exception to the rule below
about build output: it reads `website/dist/`, which is gitignored. The rule
exists because stale or absent output makes a check lie, and neither is
possible here — it only ever runs on the artifact of the build it is attached
to, and it exits 1 rather than passing when `dist/` is missing. Grading the
emitted files is the whole point: a link reaches the page by five different
routes (`withBase()`, the Sätteri plugin, its raw-node pass, the markdown text
rewrite, absolute URLs assembled by hand in the sitemap and feed), and a
source-level rule would have to know all five. The output knows none of them.

`check-perf` compiles a generated 10,000-token design system with every
exporter and holds it to a time and a memory budget, plus the same project at
1,000 tokens to catch anything that grows faster than linearly on any machine
(issue #97). Its budgets sit an order of magnitude above a normal run, but a
timing can still fail for a reason that is not the tree (a laptop on battery, a
busy runner), and `check:all` must be red only for the tree. So CI runs it as
its own step, and so can you: `npm run check:perf`. Its deterministic half (the
project compiles without an error, and long alias chains resolve) does not
depend on the clock; the alias-chain part of it is also in `check-cli`, so
`check:all` still catches a resolver that recurses per link. When it fails,
`npm run bench` (below) shows which stage moved.

`check-secrets` audits every blob that has ever existed in any ref, which does
not change when you edit a file — running it on every `check:all` would re-scan
167 commits to learn nothing. It belongs before a release, or after anything
unusual, and RELEASING.md says so. It also self-tests: each detector is checked
against a synthetic positive before the scan, because a scanner whose regexes
quietly stopped matching reports "clean" forever and reads exactly like a repo
with nothing to find.

`bench.mjs` (`npm run bench`) neither checks nor renders: it measures. It
compiles generated design systems from 1,000 to 100,000 tokens (from
`lib/large-ds.mjs`, the same generator `check-perf` uses), each in its own
process, and prints a table of the median compile time, the time of each
pipeline stage and each exporter, and the peak memory. Nothing reads its
output; [docs/findings/performance.md](../docs/findings/performance.md) records
a run with its machine and date.

Nine scripts here render rather than check:

- `gen-schemas.mjs` and `gen-brand.mjs` render what `check-schemas.mjs` and
  `check-brand.mjs` then prove are current — the published JSON schemas, and
  every file derived from the brand mark.
- `gen-figures.mjs` renders the blog's figures — miniature interfaces painted
  entirely in one example's compiled values — and carries its own guard, which
  is why it appears in the table above too: `--check` re-renders in memory and
  fails on any byte of drift, the same bargain `gen-brand.mjs` makes. A picture
  of output nobody compiled is the thing the coverage report exists to prevent.
- `gen-matrix.mjs` renders the docs' slot matrix (`website/src/docs/slot-matrix.md`): which
  targets read each catalog slot, from Acme compiled with every exporter while the compiler records
  the slots each one reads (each target's `reads`, turned into the matrix by `consumption()` from
  `@transtyle/core`, the code behind `transtyle check --matrix`).
  Its `--check` regenerates the page in memory and fails on any difference, so a hand edit or an
  exporter that starts reading a new slot both turn it red until the page is regenerated.
- `gen-catalog-signals.mjs` renders `docs/findings/catalog-signals.md`: every `unsupported`
  coverage row of every official exporter on every example, grouped by the `meaning` key the
  exporter declares on it and checked against the registry in `docs/findings/catalog-meanings.json`.
  PrimeNG is read slot by slot from its emitted preset and reconciled with its own report — the
  reconciliation is how the primary ramp was found counted as Aura's default. Its `--check` fails
  on a stale page, an unregistered key, or a registered key nothing reports any more. It compiles
  through `lib/compile-examples.mjs`, the in-process compile any generated view of the examples
  should share.
- `gen-social-card.mjs` renders the card a launch post carries, with every value
  on it read from a fresh compile of `examples/acme` rather than drawn by hand.
  Its output is gitignored (`brand/social/`) and has no checker, which is the
  difference between it and the two above: the brand assets are referenced by a
  dozen surfaces and must not drift, while a social card is referenced by
  nothing here and belongs to the post it was rendered for.
- `record-demo.mjs` re-records the README's hero GIF (`media/demo.gif`): it builds the Acme and Cathode
  Bootstrap demos, serves them side by side and drives them with Playwright, encoding with the
  `ffmpeg-static` binary under 2 MB. That binary is its own package, `scripts/record-demo/` (not a
  workspace), because installing it downloads from GitHub releases and every CI job runs the root
  `npm ci`. It has no checker and no CI job, because it needs a browser: run
  `npm ci --prefix scripts/record-demo` and `npx playwright install chromium` once, then
  `npm run demo:record`, whenever the demos' look
  changes, and commit the new GIF.
- `sync-latest-tag.mjs` moves the `latest` npm dist-tag after a release.
- `release-notes.mjs` renders the GitHub Release body, taking the union of the
  twelve lockstep changelogs so the page says each change once instead of twelve
  times.

## Rules for writing one

**A checker computes what it grades.** It may read the repository — sources,
configs, checked-in inventories, docs — and it may compile or build. It must
never read `examples/*/dist/` or any other gitignored build output. That tree
is absent on a fresh clone and stale everywhere else, so a check that reads it
either finds nothing to say or grades a build that predates the change under
test. Both were live: `check-doc-numbers` failed its first CI run on the empty
case, and `check-schemas` quietly graded whatever build happened to be lying
around until it was made to build its own. Compiling an example in-process
(`compile({ cwd, emit: false })`) costs about a second and answers the question
you actually meant to ask.

**A checker earns its place by catching something.** Every header comment says
what went wrong that made the script necessary. Keep that habit — it is what
stops the suite from accumulating checks nobody can justify deleting.

**Verify the failure, not just the pass.** A green check proves nothing until
you have watched it go red for the right reason. Break the input on purpose,
run it, confirm the message names the real problem, then put it back. Several
of these scripts record that they were validated this way; do the same.

**Extend rather than multiply.** When a new class of drift appears, the first
question is which existing checker it belongs to. `check-docs` grew from four
checks to six that way. A new file is for a genuinely new subject.

**Fail with the fix, not just the fault.** Messages here name the file, the
claim, and what to change (`— rewrite the line as: …`). The person reading it
is usually mid-task and does not want to go source-diving to learn what the
checker already knows.

**Exit 1 with a list, 0 with one summary line.** Print every violation, not the
first: a run that reports one problem at a time turns a five-minute fix into
five round trips. The summary line on success states what was actually
verified, with counts — it is the only evidence anyone reads on a green run.
