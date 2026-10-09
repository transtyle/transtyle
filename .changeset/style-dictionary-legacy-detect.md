---
'@transtyle/core': patch
---

Name Style Dictionary v3 token files instead of loading them as empty.

A token file that uses `value`/`type` without the `$` prefix (the Style Dictionary v3 format) has no DTCG token in it, so it used to compile to an empty tree and end with `TST1201 semantic.color.primary.solid is not authored`, plus a `TST1305` warning per top-level group, without ever naming the format as the cause. LOAD now recognizes a file with `value` leaves and no `$value` anywhere and reports one `TST1307` error per file, naming the file and the first legacy token, with a hint on the renames to make (`value` → `$value`, `type` → `$type`, `comment` → `$description`, `{a.b.c.value}` → `{a.b.c}`). The `TST1201` and `TST1305` noise for that file is gone. The `transtyle migrate --from style-dictionary` codemod is still to come.
