# The checkers

Sixteen scripts, one job each, all chained by `npm run check:all` and run
individually by CI. Every one exists because something real broke or could
have: they are not a test suite grown for coverage, they are a list of
mistakes this project has already made once.

| Script                        | Guards                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `check-sync.mjs`              | Every shipped exporter exists on all five surfaces (code, spec, website, README, examples)      |
| `check-docs.mjs`              | Website structure: nav reachability, links, anchors, CLI commands, diagnostic codes, blog posts |
| `check-doc-numbers.mjs`       | Every number the docs copy out of a build, re-derived                                           |
| `check-encoding.mjs`          | Tracked text files are clean UTF-8 — no NUL bytes, no BOM                                       |
| `check-color.mjs`             | The colour engine against reference values: parsing, round-trips, contrast, mixing              |
| `check-plugins.mjs`           | Every official exporter passes the published plugin conformance suite                           |
| `check-grid.mjs`              | Catalog completeness and the frozen Phase 0 values                                              |
| `check-fixtures.mjs`          | A fresh build against the Phase 0 acceptance fixtures, key by key                               |
| `check-determinism.mjs`       | Two builds of every example, byte-compared                                                      |
| `check-schemas.mjs`           | Published JSON schemas match their source objects; every config and report validates            |
| `check-cli.mjs`               | `init` / `add` / `build` / `explain` / `diff` golden paths and error cases                      |
| `check-component-tier.mjs`    | The empty tier defaults correctly; an authored tier reaches both component targets              |
| `check-bootstrap-surface.mjs` | Bootstrap's checked-in surface inventory against the real `_variables.scss`                     |
| `check-coverage-bar.mjs`      | Every inventoried Bootstrap/PrimeNG slot is accounted for, with a note on every gap             |
| `check-minimal-ds.mjs`        | All eight exporters survive a three-token design system, in six mode shapes                     |
| `check-demo-parity.mjs`       | Every example's demo for a given target is the same application                                 |

`gen-schemas.mjs` is not a checker — it renders the published schemas that
`check-schemas.mjs` then proves are current.

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
