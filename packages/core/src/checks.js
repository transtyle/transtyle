/** Built-in accessibility/consistency checks (docs/specs/validation-and-coverage.md). */

import { contrastRatio } from './color.js';

const S = 'semantic.color.';

export function runChecks(normalized, config, diagnostics) {
  const min = 4.5; // WCAG 2.1 AA normal text
  const pairs = [
    ['text.base', 'background.base'],
    ['text.base', 'surface.base'],
    ['text-muted.base', 'background.base'],
    ['text-muted.base', 'surface.base'],
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
