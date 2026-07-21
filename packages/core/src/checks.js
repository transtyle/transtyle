/** Built-in accessibility/consistency checks (docs/specs/validation-and-coverage.md). */

import { contrastRatio } from './color.js';

const S = 'semantic.color.';

export function runChecks(normalized, config, diagnostics) {
  const min = 4.5; // WCAG 2.1 AA normal text
  const pairs = [
    ['text.base', 'elevation.0.surface'],
    ['text.base', 'elevation.1.surface'],
    ['text.muted', 'elevation.0.surface'],
    ['text.muted', 'elevation.1.surface'],
  ];
  for (const mode of normalized.modeValues) {
    const map = normalized.modes[mode];
    for (const [fg, bg] of pairs) {
      const f = map.get(S + fg)?.value;
      const b = map.get(S + bg)?.value;
      if (!f || !b) continue;
      const ratio = contrastRatio(f, b);
      if (ratio < min) {
        diagnostics.warn('TST2101',
          `${fg} vs ${bg} is ${ratio.toFixed(1)}:1 in ${mode} mode (< ${min}:1 ${config.check?.contrast?.standard ?? 'wcag21-aa'})`);
      }
    }
  }
}
