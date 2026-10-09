# Style Dictionary v3 files loaded as empty trees

Issue [#54](https://github.com/transtyle/transtyle/issues/54). A token file in
the Style Dictionary v3 dialect (`value`/`type`/`comment` without `$`) has no
`$value` anywhere, so LOAD accepted it as a DTCG document with zero tokens. The
user saw one `TST1305` warning per group and then `TST1201 primary.solid is not
authored`, and nothing said the format was the problem.

## What landed

Detection only, the first of the issue's two deliverables.
`validateTokenTree` (`packages/core/src/load.js`) now looks for a legacy leaf
before anything else: an object with a `value` key, in a tree where no node has
`$value`. It reports one `TST1307` error for the file, naming the file and the
first legacy token, with a hint listing the renames, and stops. `compile()`
counts `TST1307` among the upstream causes, so `TST1201` is not added on top.
Documented in the diagnostics page and in
[validation-and-coverage.md](../specs/validation-and-coverage.md).
`scripts/check-cli.mjs` grades it against
`packages/core/test-fixtures/style-dictionary-legacy`.

## Decisions

- **Leaf test.** A `value` key counts when it holds a primitive or an array, or
  when a sibling `type`/`comment`/`attributes` is there (an SD composite value
  is an object). A group that merely has a child named `value` stays a group.
  A file with any `$value` is never legacy (mixed files are the author's call).
- **Code number.** `TST1307`, the next free one, as the refinement on the issue
  proposed.
- **Hint wording.** The hint says the codemod is planned, not that it exists
  (implemented-only policy); the CLI spec still lists `migrate` as specced.

## Follow-up

The codemod landed afterwards, see [the migrate worklog entry](2026-10-09-migrate-from-style-dictionary.md). The hint now says what it does instead of calling it planned.
