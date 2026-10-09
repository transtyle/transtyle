# Source locations and `check.suppress`

Issue [#7](https://github.com/transtyle/transtyle/issues/7). Two unimplemented items of the
validation spec: a diagnostic naming the file and line of the token it is about, and a way to
silence a deliberate warning without hiding that it was silenced.

## What shipped

- `packages/core/src/locate.js`: a single-pass scanner that records the line and column of every
  object key (not `$`-keys, not inside arrays) of a JSON text `JSON.parse` already accepted.
  LOAD keeps the map next to each tree; NORMALIZE records `sources` (path to file, line, column)
  while merging the base layers, last layer winning. Token diagnostics gain a structured `path`
  and `compile()` fills `file`/`line`/`column` in one pass (`locations.js`), so no call site
  handles files. `TST1107`/`TST1108` read their own mode layer's positions; `TST1002` takes the
  line from the `position N` in the parser's message.
- `check.suppress` entries `{ code, path?, reason }`; `Diagnostics.applySuppressions` moves
  matching warnings and infos into `suppressed`, run once before the target loop.
  `reason` needed two new keywords in the validator (`minLength`, `pattern`), which also reach the
  published editor schema.
- `TST1012` (info): an entry that silenced nothing.

## Decisions

- **Silence, not downgrade.** A downgraded diagnostic would still have to be reasoned about by
  `failOn` and every consumer; silence plus a `suppressed` entry is the same information with one rule.
- **Errors are not suppressible.** They mean the output is wrong. An entry matching only an error
  is reported by `TST1012`.
- **`TST1012` is `info`.** A filtered build (`build shadcn`) runs fewer checks, and a suppression is
  often kept across a refactor; a warning would fail `failOn: "warning"` projects for either.
  The code is in the config family (`TST10xx`) because the entry is config; `TST1113`, `TST1205`,
  `TST1308`, `TST1309` were already promised elsewhere.
- **Plan deviations.** The `target` key of the refinement was cut: a diagnostic is per-token or
  per-target, not both today, and per-target "I know" belongs to #89. Nothing else changed.
  The exporter-mode warning from #9 does not exist yet; when it lands, an entry `{ code, reason }`
  silences it, and its docs note on `failOn: "warning"` should point at `check.suppress`.
- **Derived values have no line.** `TST2101` on an `on-solid` and `TST1201` carry a `path` (so a
  suppression can match them) but no file, because the value is in no file. The config file is not
  scanned yet; `locate.js` can be reused for it.
- A key containing a `.` is ambiguous in a dotted path; token names with dots are not supported
  by the IR either.
