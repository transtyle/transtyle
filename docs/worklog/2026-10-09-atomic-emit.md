# EMIT writes atomically

Issue [#90](https://github.com/transtyle/transtyle/issues/90).
[pipeline.md](../architecture/pipeline.md#5-emit) specced "atomic staging and
swap, so a failed build leaves no half-written output", and core wrote each file
straight into its output directory as each exporter finished. An exporter that
threw on the second of three targets, or a second target that raised an
`error`-level diagnostic, left the first target's files updated and the others
stale, with nothing marking the mix.

## What changed

`compile()` now collects every target's files (and its `report.json`, built at
the same point as before, so the bytes are identical) and hands them to
`commitOutputs` in `packages/core/src/emit.js`:

1. all files are staged under `<output>.transtyle-tmp/`;
2. each is renamed onto its destination, a file it replaces being moved to
   `<output>.transtyle-bak/` first, with a journal of every step;
3. on any failure the journal is replayed backwards and the exception
   propagates; both staging directories are removed either way.

No file is written when an `error`-level diagnostic exists after the last
target (an exporter crash, `TST3001`, included), so `results[].files` is empty in
that case. This supersedes the rule from
[the exporter-crash diagnostic](2026-10-09-exporter-crash-diagnostic.md) that
the other targets are still built when one crashes: they still all run, so every
crash is reported at once, but nothing reaches the disk until all succeed.
Issue #90's acceptance (a throwing second target leaves both outputs as they
were) is incompatible with building around the crash.

`npm run check:atomic-emit` covers an exporter throwing on the second target, an
unknown second target, a swap that fails after earlier targets were already
renamed in, and a clean rebuild.

## Deviations from the issue

- **Per file, not per directory.** The issue proposed renaming whole directories
  per target, "or per file where the output dir is shared". A directory rename
  would drop every file this build did not produce, which the same issue says to
  leave alone, so the swap is per file everywhere.
- **No `stale` summary.** It needs the manifest (#10), which does not exist yet.
- **Not crash-proof.** A hard kill in the middle of the rename pass can leave a
  mix; the next build repairs it. Making that window crash-safe needs a
  directory-level pointer swap, which the per-file rule above rules out.
