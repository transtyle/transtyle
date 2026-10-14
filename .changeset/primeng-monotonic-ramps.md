---
'@transtyle/exporter-primeng': patch
---

Make the PrimeNG `primary` and `surface` ramps run in order from 700 to 950.

Step 900 pinned the role's `text` slot, which the standard derives by walking from `solid-active`, so it landed on the same lightness as 700 and the ramp folded back: 700, 800 and 900 read dark, darker, dark again, then 950. Step 900 is now a mix of `solid-active` toward `text-strong` (75%), after 800 at 50%. Steps 0 to 800 and 950 are unchanged. A role whose authored `solid` sits at `text-strong`'s lightness (Cathode's primary) still goes out of order below 700, because the authored value wins.
