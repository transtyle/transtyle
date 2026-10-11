---
'@transtyle/ir': patch
'@transtyle/core': patch
'@transtyle/exporter-bootstrap': patch
---

Treat token groups and binding slots named after built-in object properties as ordinary names, and parse colors in linear time.

A group called `constructor` or `toString` was merged into the property every JavaScript object already has under that name; it now merges like any other group, in token layers and in `bindings` alike. Color strings (`rgb()`, `oklch()`, `color()` and the rest) and the Bootstrap exporter's reading of trailing comments on dropped declarations now take time proportional to their length. Valid colors parse to the same values, and every example builds to the same output.
