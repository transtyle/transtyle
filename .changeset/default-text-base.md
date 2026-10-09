---
'@transtyle/core': minor
---

An unauthored `semantic.color.text.base` now defaults per mode instead of staying empty.

DERIVE picks whichever of near-black and white contrasts more with the mode's page (`elevation.0.surface`), with provenance `defaulted` and rule `default-text`, so a design system that authors only `primary.solid` gets near-black text on white in light mode and white on near-black in dark mode, and the whole content side derives from it: `text.muted`, `text.subtle`, `text.disabled`, `text.strong`, `text.inverse` and every `<role>.text-strong`. Exporters that used to leave the body text to the target's own defaults (shadcn `--foreground`, daisyUI `--color-base-content`, Bootstrap `$body-color` and `$dark`, Storybook `textColor`, ECharts `textStyle.color`…) now emit it. An authored `text.base` always wins, including an alias that resolves after derivation; design systems that author it get byte-identical output.
