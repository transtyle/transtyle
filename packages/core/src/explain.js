/**
 * explainToken — the provenance walk behind `transtyle explain`, as data
 * (docs/specs/cli.md "Programmatic parity"). The CLI is a formatter over it.
 */

import { levenshtein } from './nearest.js';

/** The walk stops after this many levels of rule inputs below the slot itself. */
export const EXPLAIN_MAX_INPUT_DEPTH = 3;

/** How many near-miss slot names an `unknown-slot` error carries. */
const CLOSEST_COUNT = 5;

const bareName = (p) => p.replace(/^semantic\.(color\.)?/, '');

function explainError(code, message, extra) {
  return Object.assign(new Error(message), { code, ...extra });
}

/**
 * Explain where a resolved slot's value comes from.
 *
 * @param normalized the `normalized` field of `compile()`'s result
 * @param slot a slot path; a bare path such as `primary.solid` is also tried
 *   as `semantic.<slot>` and `semantic.color.<slot>`
 * @param {{ mode?: string }} [options] defaults to `normalized.defaultMode`
 * @returns {{ slot: string, mode: string, entry: object, inputs: object[] }}
 *   `entry` is `{ type, value, provenance }` (raw IR value). Each input is the
 *   same shape, or `{ path, unresolved: true }`, or `{ path, entry, seen: true }`
 *   (already shown higher up), and carries `truncated: true` when the depth
 *   limit cut off its own inputs.
 * @throws Error with `code` `unknown-mode` (`available`) or `unknown-slot` (`closest`)
 */
export function explainToken(normalized, slot, { mode } = {}) {
  const useMode = mode ?? normalized.defaultMode;
  const map = normalized.modes[useMode];
  if (!map) {
    throw explainError('unknown-mode', `Unknown mode "${useMode}" (available: ${normalized.modeValues.join(', ')})`, {
      mode: useMode,
      available: [...normalized.modeValues],
    });
  }

  const resolvePath = (raw) => {
    for (const candidate of [raw, `semantic.${raw}`, `semantic.color.${raw}`]) {
      if (map.has(candidate)) return candidate;
    }
    return null;
  };

  const fullPath = resolvePath(slot);
  if (!fullPath) {
    const bare = bareName(slot);
    const closest = [...map.keys()]
      .map((k) => [k, levenshtein(bare, bareName(k))])
      .sort((a, b) => a[1] - b[1])
      .slice(0, CLOSEST_COUNT)
      .map(([k]) => k);
    throw explainError('unknown-slot', `Unknown slot: ${slot}`, { slot, closest });
  }

  const seen = new Set([fullPath]);
  const walk = (path, depth) => {
    const entry = map.get(path);
    const prov = entry.provenance;
    const node = { path, entry, inputs: [] };
    if (prov.kind !== 'derived' && prov.kind !== 'defaulted') return node;
    if (!prov.inputs?.length) return node;
    if (depth >= EXPLAIN_MAX_INPUT_DEPTH) { node.truncated = true; return node; }
    for (const rawInput of prov.inputs) {
      const inputPath = resolvePath(rawInput) ?? rawInput;
      const inputEntry = map.get(inputPath);
      if (!inputEntry) { node.inputs.push({ path: rawInput, unresolved: true }); continue; }
      if (seen.has(inputPath)) { node.inputs.push({ path: inputPath, entry: inputEntry, seen: true }); continue; }
      seen.add(inputPath);
      node.inputs.push(walk(inputPath, depth + 1));
    }
    return node;
  };

  const root = walk(fullPath, 0);
  const result = { slot: fullPath, mode: useMode, entry: root.entry, inputs: root.inputs };
  if (root.truncated) result.truncated = true;
  return result;
}
