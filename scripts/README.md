# The checkers

Twenty-one scripts, one job each — eighteen chained by `npm run check:all` and
run individually by CI, plus three that guard a release, a deploy, and the
history itself.
Every one exists because something real broke or could have: they are not a
test suite grown for coverage, they are a list of mistakes this project has
already made once.

| Script                        | Guards                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `check-sync.mjs`              | Every shipped exporter exists on all five surfaces (code, spec, website, README, examples)           |
| `check-docs.mjs`              | Website structure: nav reachability, links, anchors, CLI commands, diagnostic codes, blog posts      |
| `check-doc-numbers.mjs`       | Every number the docs copy out of a build, re-derived                                                |
| `check-encoding.mjs`          | Tracked text files are clean UTF-8 — no NUL bytes, no BOM                                            |
| `check-color.mjs`             | The colour engine against reference values: parsing, round-trips, contrast, mixing                   |
| `check-plugins.mjs`           | Every official exporter passes the published plugin conformance suite                                |
| `check-grid.mjs`              | Catalog completeness and the frozen Phase 0 values                                                   |
| `check-fixtures.mjs`          | A fresh build against the Phase 0 acceptance fixtures, key by key                                    |
| `check-determinism.mjs`       | Two builds of every example, byte-compared                                                           |
| `check-schemas.mjs`           | Published JSON schemas match their source objects; every config and report validates                 |
| `check-cli.mjs`               | `init` / `add` / `build` / `explain` / `diff` golden paths and error cases                           |
| `check-component-tier.mjs`    | The empty tier defaults correctly; an authored tier reaches both component targets                   |
| `check-bootstrap-surface.mjs` | Bootstrap's checked-in surface inventory against the real `_variables.scss`                          |
| `check-coverage-bar.mjs`      | Every inventoried Bootstrap/PrimeNG slot is accounted for, with a note on every gap                  |
| `check-minimal-ds.mjs`        | All eight exporters survive a three-token design system, in six mode shapes                          |
| `check-demo-parity.mjs`       | Every example's demo for a given target is the same application                                      |
| `check-package-manifests.mjs` | What a published tarball needs and the workspace hides: access, provenance, keywords, `files`, `bin` |
| `check-brand.mjs`             | The logo everywhere: assets current, every surface still carrying it, brand hues still the mark's    |
| `check-release-tag.mjs`       | The dist-tag a release resolves to, and that a stable one can't arm the freeze by reflex             |
| `check-site-links.mjs`        | Every link in the built site sits under the Pages base path                                          |
| `check-secrets.mjs`           | No credential or personal data in any blob, commit message or identity, ever                         |

The last three are not in `check:all`, because none of them grades a working
tree.
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

`check-secrets` audits every blob that has ever existed in any ref, which does
not change when you edit a file — running it on every `check:all` would re-scan
167 commits to learn nothing. It belongs before a release, or after anything
unusual, and RELEASING.md says so. It also self-tests: each detector is checked
against a synthetic positive before the scan, because a scanner whose regexes
quietly stopped matching reports "clean" forever and reads exactly like a repo
with nothing to find.

Five scripts here are not checkers:

- `gen-schemas.mjs` and `gen-brand.mjs` render what `check-schemas.mjs` and
  `check-brand.mjs` then prove are current — the published JSON schemas, and
  every file derived from the brand mark.
- `gen-social-card.mjs` renders the card a launch post carries, with every value
  on it read from a fresh compile of `examples/acme` rather than drawn by hand.
  Its output is gitignored (`brand/social/`) and has no checker, which is the
  difference between it and the two above: the brand assets are referenced by a
  dozen surfaces and must not drift, while a social card is referenced by
  nothing here and belongs to the post it was rendered for.
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
