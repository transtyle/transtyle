# `transtyle migrate --from style-dictionary`

Issue [#54](https://github.com/transtyle/transtyle/issues/54), the codemod half.
[The detection](2026-10-09-style-dictionary-legacy-detection.md) (`TST1307`)
landed first; this is the command its hint points at. Spec:
[cli.md](../specs/cli.md#migrate---from-style-dictionary--style-dictionary-v3-to-dtcg).

## What landed

- `packages/core/src/migrate-style-dictionary.js`: the pure transform
  `migrateStyleDictionary(tree)` and `needsStyleDictionaryMigration(tree)`,
  exported from `@transtyle/core` with `loadConfig()` and `expandTokenFiles()`
  (the files the config's `tokens` entries match). `load.js` now exports the
  leaf test (`isStyleDictionaryLeaf`) that detection and the codemod share, so
  they cannot disagree on what a legacy token is.
- `packages/cli/src/migrate.js`: the command. Dry run by default (a diff per
  file on stdout, notes on stderr), `--write` applies. Nothing is written when
  any token file fails to parse.
- Golden cases and transform unit cases in `scripts/check-cli.mjs`, against the
  new fixture `packages/core/test-fixtures/style-dictionary-migrate`.

## Decisions

- **Where the transform lives.** In core, not the CLI: the refinement allowed
  either, and core keeps the "CLI holds no logic a build-tool integration cannot
  reach" rule of the CLI spec. The alternative (a `packages/cli` module) would
  have needed no new core exports.
- **Tier placement.** Each top-level group that is not a tier moves under
  `option`; a group already named `option`/`semantic`/`component` stays. The
  refinement said "wrap the whole tree"; per-group is the same for a real
  Style Dictionary file and does not double-wrap a file that already has tiers.
  References are prefixed by the same rule. No `config.json` platform reading,
  as the refinement said.
- **Idempotence by detection.** A file is migrated only when it passes the
  `TST1307` test, so the output (which has `$value`) and every DTCG or mixed file
  are skipped, with a line saying so.
- **The diff.** It compares the parsed file re-serialized before and after, not
  the raw text, so a hand-formatted file (one token per line) does not show every
  line as changed. The written file uses the file's own indent. Integer-like keys
  sort first inside their object, a JavaScript object property.
- **Type inference** only for the category names the refinement listed
  (`color`, `size`, `sizing`, `spacing`, `dimension`, font and `boxShadow`
  names); a `font` category with no `type` stays untyped, which `check` accepts.
- **Metadata.** Every key that is not `value`/`type`/`comment` goes under
  `$extensions["style-dictionary"]`, so a custom key is never dropped either.

## Deviations from the refinement

None in behavior. The acceptance fixture lives in `packages/core/test-fixtures/`
beside the detection fixture rather than `examples/`, because the examples are
graded by `check:sync` and the demos, which a Style Dictionary source is not.
