---
'@transtyle/core': minor
'@transtyle/cli': minor
---

New `transtyle catalog [--json]` command and `catalog()` export: every slot of the catalog, with its DTCG type, the rule that fills it when unauthored, that rule's inputs and the optional anchor it requires, as a table or as one deterministic JSON object. It needs no project. Editors, agents and tools can read the vocabulary from it instead of re-deriving it from the docs or the source.
