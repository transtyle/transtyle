---
'@transtyle/core': minor
'@transtyle/cli': minor
---

Bind a whole vocabulary with pattern rules in the config.

A new optional `bindings` array in `transtyle.config.json` holds rules like `{ "slot": "semantic.color.{role}.solid", "from": "{option.color.{role}.600}" }`. `{role}` iterates the built-in and custom color roles, `{rung}` the text rungs, `{level}` the elevation levels; `roles` restricts `{role}`. Rules expand at load into plain aliases, so exporters and `diff` see nothing new; a slot already bound in a token file always wins over a rule, a rule whose target token is missing skips that slot unless it is `required`, and `explain` names the rule behind an alias. `transtyle bindings --expand` prints the expansion as a token file to freeze it. New diagnostics `TST1117` (malformed rule), `TST1118` (required target missing) and `TST1119` (two rules bound one slot).
