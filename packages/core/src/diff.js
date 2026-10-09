/**
 * Semantic diff of two resolved IRs (docs/specs/diff.md, ROADMAP P6). Pure and
 * deterministic: no I/O, no git — the CLI resolves "before" (a git ref) and
 * "after" (the working tree) via compile() and hands both here.
 *
 * The unit of a design-system change is a **semantic slot value in a mode**, not
 * a token-file line: renaming an option token or restructuring layers that leaves
 * every resolved value identical is correctly reported as no change, because the
 * compiled themes are identical. That is the whole point of diffing the resolved
 * graph rather than the source.
 */

import { contrastPairs, pairContrast } from './checks.js';
import { wcagContrast, checkStandard } from './contrast.js';

/** Canonical, stable string form of a resolved value, for equality only. */
function canon(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return `[${value.map(canon).join(',')}]`;
  // plain data objects (color components, typography/shadow composites) — sort
  // keys so equality is independent of construction order.
  return `{${Object.keys(value).sort().map((k) => `${k}:${canon(value[k])}`).join(',')}}`;
}

const provKind = (entry) => entry?.provenance?.kind ?? null;

/**
 * @returns {{ modes: Array<{ mode, added: string[], removed: string[],
 *   changed: Array<{ slot, before, after, valueChanged, provChanged }> }>,
 *   changedSlots: Set<string>, hasChanges: boolean }}
 */
export function diffResolved(before, after) {
  const modeNames = [...new Set([...Object.keys(before.modes), ...Object.keys(after.modes)])].sort();
  const modes = [];
  const changedSlots = new Set();

  for (const mode of modeNames) {
    const b = before.modes[mode] ?? new Map();
    const a = after.modes[mode] ?? new Map();
    const slots = [...new Set([...b.keys(), ...a.keys()])].sort();
    const added = [], removed = [], changed = [];

    for (const slot of slots) {
      const be = b.get(slot);
      const ae = a.get(slot);
      if (!be && ae) { added.push(slot); changedSlots.add(slot); continue; }
      if (be && !ae) { removed.push(slot); changedSlots.add(slot); continue; }
      const valueChanged = canon(be.value) !== canon(ae.value);
      const provChanged = provKind(be) !== provKind(ae);
      if (valueChanged || provChanged) {
        changed.push({ slot, before: be, after: ae, valueChanged, provChanged });
        changedSlots.add(slot);
      }
    }
    modes.push({ mode, added, removed, changed });
  }

  const hasChanges = modes.some((m) => m.added.length || m.removed.length || m.changed.length);
  return { modes, changedSlots, hasChanges };
}

/**
 * Accessibility regressions introduced by the change (docs/specs/diff.md).
 *
 * `check` tells you the contrast is bad *now*; this tells you **this change made
 * it bad** — which is the question a reviewer has, and the one a passing-CI
 * baseline can regress on silently. Uses the same pairs and contrast standard as
 * `runChecks`, so the two can never disagree about what "passing" means.
 *
 * `contrast` is the `contrast` a compile returns (the after side's standard).
 * Without it the config's WCAG level is used; an `apca` config needs it, since
 * only compile() loads the APCA package.
 *
 * Severities, worst first:
 *   `regressed` — passed the standard before, fails now (the headline case)
 *   `worsened`  — already failing, and the contrast dropped further (by more
 *                 than 0.05 of a ratio, or 1 Lc)
 *
 * A pair that improves, or that fails identically on both sides, is not reported.
 * Values are ratios under WCAG and signed Lc under APCA (`unit` says which);
 * comparisons use their magnitude.
 *
 * @returns {Array<{ mode, fg, bg, before: number, after: number, status, threshold, unit, standard }>}
 */
export function contrastRegressions(before, after, config, contrast) {
  if (!contrast) {
    if (checkStandard(config) === 'apca') {
      throw new Error('contrastRegressions: pass the `contrast` that compile() returned (APCA is loaded by compile)');
    }
    contrast = wcagContrast(checkStandard(config));
  }
  const { standard, unit } = contrast;
  const out = [];
  const pairs = contrastPairs(after);
  for (const mode of Object.keys(after.modes)) {
    const bMap = before.modes[mode];
    const aMap = after.modes[mode];
    if (!bMap || !aMap) continue; // mode added or removed — not a regression
    for (const [fg, bg, use] of pairs) {
      const b = pairContrast(bMap, fg, bg, contrast);
      const a = pairContrast(aMap, fg, bg, contrast);
      if (b === null || a === null) continue;
      const threshold = contrast.threshold(use);
      const sb = contrast.score(b);
      const sa = contrast.score(a);
      const row = { mode, fg, bg, before: b, after: a, threshold, unit, standard };
      if (sb >= threshold && sa < threshold) {
        out.push({ ...row, status: 'regressed' });
      } else if (sb < threshold && sa < threshold && sa < sb - contrast.tolerance) {
        out.push({ ...row, status: 'worsened' });
      }
    }
  }
  return out;
}
