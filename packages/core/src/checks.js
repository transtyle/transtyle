/** Built-in accessibility/consistency checks (docs/specs/validation-and-coverage.md). */

import { contrastRatio } from './color.js';

const S = 'semantic.color.';

/**
 * The foreground/background pairs the compiler contrast-checks. Shared with
 * `transtyle diff`'s contrast-regression flag (diff.js) so "which pairs count"
 * has exactly one definition — a pair added here is checked in both places.
 */
export const CONTRAST_PAIRS = [
  ['text.base', 'elevation.0.surface'],
  ['text.base', 'elevation.1.surface'],
  ['text.muted', 'elevation.0.surface'],
  ['text.muted', 'elevation.1.surface'],
];

/** Minimum ratio for the configured standard (normal text). */
export function contrastThreshold(config) {
  return config?.check?.contrast?.standard === 'wcag21-aaa' ? 7 : 4.5;
}

/** The pair's ratio in one resolved mode map, or null if either slot is absent. */
export function pairRatio(map, fg, bg) {
  const f = map.get(S + fg)?.value;
  const b = map.get(S + bg)?.value;
  if (!f || !b) return null;
  return contrastRatio(f, b);
}

export function runChecks(normalized, config, diagnostics) {
  const min = contrastThreshold(config);
  const standard = config?.check?.contrast?.standard ?? 'wcag21-aa';
  for (const mode of normalized.modeValues) {
    const map = normalized.modes[mode];
    for (const [fg, bg] of CONTRAST_PAIRS) {
      const ratio = pairRatio(map, fg, bg);
      if (ratio === null) continue;
      if (ratio < min) {
        diagnostics.warn('TST2101',
          `${fg} vs ${bg} is ${ratio.toFixed(1)}:1 in ${mode} mode (< ${min}:1 ${standard})`);
      }
    }
  }
}
