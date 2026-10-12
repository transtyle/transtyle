---
'@transtyle/core': patch
---

Compile large design systems faster: core no longer redoes the same work for every target.

Recording which slots each exporter reads used to copy every mode map before each target ran. The recording now reads the original maps, and an exporter that writes to its view still writes to its own copy. The list of custom `semantic.*` tokens was rebuilt and sorted twice per target; it is now built once per compile. On a 10,000-token design system with four mode combinations, a compile with every exporter takes about a third less time, and about 40% less with long alias chains. Every output is unchanged.
