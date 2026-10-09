# `transtyle bind --suggest` (#60)

## The change

`suggestBindings({ cwd })` in `@transtyle/core` (`packages/core/src/suggest.js`)
proposes, for every catalog slot in scope that nothing binds yet, the project token
that fills it, and `transtyle bind --suggest` prints it: an annotated alias token
file on stdout, the same proposals as `bindings` rules with `--rules`, the whole
report with `--json`, the table on stderr. The name table is versioned data
(`packages/core/src/synonyms.js`, `synonyms@1`). Behavior and thresholds:
[cli.md](../specs/cli.md#bind---suggest--a-first-draft-of-the-bindings).

## Measured

Each example that keeps a bindings file, copied with that file left out of its
config (`scripts/check-cli.mjs` does exactly this on every run):

| Example | In-scope bindings recovered | Confidence of the proposals | Proposed beyond the file |
| ------- | --------------------------- | --------------------------- | ------------------------ |
| Cathode | 9 of 10                     | 2 high, 5 medium, 2 low     | none                     |
| GOV.UK  | 13 of 13                    | 11 high, 2 medium           | none                     |
| Carbon  | 15 of 15                    | 12 high, 3 medium           | none                     |

"In scope" leaves out `neutral.solid` (never proposed: both examples that bind it
call it a judgment), `radius.md` (a literal, not a binding) and Cathode's
`crt-amber` custom role. Cathode's miss is `font.sans`, which it binds to its mono
stack on purpose; no sans-serif token exists to find. Its `primary.solid` (`ink`)
comes from chroma in the default mode alone, so it is `low`; `warning` (`amber`)
and `danger` (`meltdown`) come from hue alone, `medium`. GOV.UK's deliberately
derived `secondary`, `accent`, `warning` and `info` stay unproposed: `govuk.brand`
sits close to the `info` anchor and `govuk.focus` to the `warning` one, but both
names place them elsewhere. Carbon's `text-primary` is read as a text rung, not the
brand. Acme authors its slots in place: everything in scope is bound or left to
derivation, nothing proposed. Two runs are byte-identical.

The fixture `packages/core/test-fixtures/bind-suggest` (a vocabulary named with the
catalog's own words, plus two brand names) comes back as four `bindings` rules,
three of them with `{role}`, `{rung}` and `{level}`, that expand to exactly its
seven aliases, and its `primary.solid` is contested, not written.

Broken on purpose: dropping `focus` from the ring words makes GOV.UK propose
`focus-text` for `text.base` and lose `ring`, Carbon lose `ring`; `check:cli`
fails on all three.

## Deviations from the refinement

- **No `--write`.** The file goes to stdout, like `bindings --expand`; redirecting
  it is the write. One less flag, and nothing can overwrite a file.
- **Contested slots are not written**, the refinement's open question. They are
  listed in the file's root `$description` and on stderr. A live alias with the
  runner-up in its description would compile as `native` before anyone ratified
  it, which the importer contract (clause 4) rules out.
- **No slot enumeration in `@transtyle/ir`.** `catalog()` (#153) landed first and
  is the enumeration: the scope is checked against it, and the status anchors'
  hues are read off its `hue-anchor(n)` rules rather than restated.
- **ΔE**: `deltaEOK` from `checks.js` (#145), not a new helper next to `color.js`.
- **`option.*` tokens count on name evidence only**, never on value: GOV.UK's
  option yellow is the `focus` color and would otherwise be proposed for `warning`
  (low, but still in the file).
- **Usage in the source (signal d) is not measured**: every candidate in the three
  examples scores 0 once the bindings are gone, as the refinement found.
- **`--rules`** is new: the proposals as pattern rules (ADR-0012), generalized only
  where `expandBindings()` gives back exactly the proposals.
- Name-confirmation measurements were widened where real bindings failed the strict
  one: a status name is confirmed within 15° (value alone needs 10°), a link name by
  3:1 on the page (Carbon's dark links are not near the derived ones), a muted-text
  name by "readable but quieter than body text" (Carbon's dark `text-secondary` is
  ΔE 0.104 from the derived one).
