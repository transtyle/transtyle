---
'@transtyle/core': patch
'@transtyle/plugin-kit': patch
---

Accept the DTCG structured value forms instead of writing `[object Object]` into stylesheets.

A `dimension` or `duration` authored as `{ "value": 16, "unit": "px" }`, a `cubicBezier` authored as `[0.2, 0, 0, 1]`, and a `fontWeight` authored as a DTCG keyword such as `"semi-bold"` used to reach every exporter as a JavaScript value: six targets wrote `[object Object]` (or `0.2,0,0,1`, or `semi-bold`), Storybook and ECharts dropped the value, and an object-form `radius.md` broke the derived radius scale with a misleading `TST1105` — all without a diagnostic. NORMALIZE now canonicalizes these forms, also as members of `typography`, `shadow`, `border` and `transition` composites, to the CSS string exporters already read (`16px`, `cubic-bezier(0.2, 0, 0, 1)`, `600`), so both authoring forms compile byte-identical on every target and the IR value contract exporters see is unchanged. A malformed structured value (no unit, an unknown unit, a non-number `value`, a bare non-zero number for a dimension, an unknown weight keyword) now stops the build with `TST1106` and a hint naming the accepted forms. CSS strings are carried as authored, exactly as before.

The plugin-kit fixture authors its radius, a duration and an easing in the structured form, so conformance runs prove a plugin receives the CSS string.
