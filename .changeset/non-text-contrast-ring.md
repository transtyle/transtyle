---
'@transtyle/core': minor
---

`check` now holds the focus ring to a non-text contrast level (`TST2101`).

`ring` on `elevation.0.surface` and `elevation.1.surface` must reach 3:1 under `wcag21-aa` and `wcag21-aaa` (WCAG 2.1 SC 1.4.11) and Lc 30 under `apca`, whose Bronze mode has no non-text level. In a `contrast: more` combination the ring is raised to 4.5:1 or Lc 45, not to the 7:1 of text. Borders stay unchecked: they measure 1.2:1 to 1.6:1 on every example and the catalog default, and most are decorative. `transtyle diff` flags a ring regression like any other pair. A derived ring on a very light or very dark brand can warn; GOV.UK suppresses the pair, since its yellow focus is paired with a dark outline.
