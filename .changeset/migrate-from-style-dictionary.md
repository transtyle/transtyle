---
'@transtyle/core': minor
'@transtyle/cli': minor
---

New `transtyle migrate --from style-dictionary [--write]` codemod: it rewrites Style Dictionary v3 token files (`value`/`type`/`comment` without the `$`) to DTCG, the follow-up to the `TST1307` detection.

It reads the files your config's `tokens` list matches. Without `--write` it prints a diff per file and changes nothing; with it, the files are rewritten in place. `value`/`type`/`comment` become `$value`/`$type`/`$description`, a trailing `.value` goes from every `{a.b.c.value}` reference, Style Dictionary type names become DTCG ones (`size` → `dimension`, `fontFamilies` → `fontFamily`, `boxShadow` → `shadow`, …), a missing `type` is inferred from the top-level group, and build metadata (`attributes`, `name`, `filePath`, …) is kept under `$extensions["style-dictionary"]`. Style Dictionary has no tiers, so top-level groups move under `option` and references follow; binding the `semantic` tokens stays the author's job. The output is deterministic with keys in their original order, and a second run changes nothing. Core exports the pure transform as `migrateStyleDictionary()` (with `needsStyleDictionaryMigration()`, `loadConfig()` and `expandTokenFiles()`), and the `TST1307` hint now points at the command.
