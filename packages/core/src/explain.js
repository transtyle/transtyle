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
 *   `entry` is `{ type, value, provenance }` (raw IR value). `inputs` holds a
 *   derived or defaulted entry's rule inputs, or an aliased entry's alias
 *   target (followed without counting toward the depth limit). Each input is
 *   the same shape, or `{ path, unresolved: true }`, or `{ path, entry, seen:
 *   true }` (already shown higher up), and carries `truncated: true` when the
 *   depth limit cut off its own inputs.
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
    const visit = (rawInput, nextDepth) => {
      const inputPath = resolvePath(rawInput) ?? rawInput;
      const inputEntry = map.get(inputPath);
      if (!inputEntry) { node.inputs.push({ path: rawInput, unresolved: true }); return; }
      if (seen.has(inputPath)) { node.inputs.push({ path: inputPath, entry: inputEntry, seen: true }); return; }
      seen.add(inputPath);
      node.inputs.push(walk(inputPath, nextDepth));
    };
    // An alias is followed to its target (its one input), at the same depth:
    // it adds no rule, so `component.button.radius` reaches the authored
    // `radius.md` its `semantic.radius.full` alias is derived from.
    if (prov.kind === 'aliased') {
      if (prov.target) visit(prov.target, depth);
      return node;
    }
    if (prov.kind !== 'derived' && prov.kind !== 'defaulted') return node;
    if (!prov.inputs?.length) return node;
    if (depth >= EXPLAIN_MAX_INPUT_DEPTH) { node.truncated = true; return node; }
    for (const rawInput of prov.inputs) visit(rawInput, depth + 1);
    return node;
  };

  const root = walk(fullPath, 0);
  const result = { slot: fullPath, mode: useMode, entry: root.entry, inputs: root.inputs };
  if (root.truncated) result.truncated = true;
  return result;
}

// ---------- target variables (coverage rows) ----------

/** Most `via` hops followed from one target variable (a Sass chain is rarely more than three). */
export const EXPLAIN_MAX_VIA_DEPTH = 6;

/**
 * The IR paths a coverage row reads (docs/specs/validation-and-coverage.md):
 * its `slots`, else its `slot` when that label is itself a path of the IR.
 * Labels such as `via driven roots` or `semantic.color.primary.*` read nothing.
 *
 * @param row a coverage row `{ variable, slot, slots?, via?, class, note? }`
 * @param normalized the compile's `normalized` (any mode's keys count)
 */
export function coverageSlots(row, normalized) {
  if (Array.isArray(row.slots)) return row.slots;
  return slotKeys(normalized).has(row.slot) ? [row.slot] : [];
}

const keyCache = new WeakMap();
function slotKeys(normalized) {
  let keys = keyCache.get(normalized);
  if (!keys) {
    keys = new Set();
    for (const map of Object.values(normalized.modes)) if (map instanceof Map) for (const k of map.keys()) keys.add(k);
    keyCache.set(normalized, keys);
  }
  return keys;
}

function targetRows(results, target) {
  const r = results.find((x) => x.target === target);
  if (!r) {
    const available = results.map((x) => x.target);
    throw explainError('unknown-target', `Unknown target "${target}" (compiled: ${available.join(', ') || 'none'})`, { target, available });
  }
  const byVariable = new Map();
  for (const row of r.coverage) {
    if (!byVariable.has(row.variable)) byVariable.set(row.variable, []);
    byVariable.get(row.variable).push(row);
  }
  return { rows: r.coverage, byVariable };
}

/**
 * A row as data, its `via` followed to the rows it names (cycle-safe, at most
 * EXPLAIN_MAX_VIA_DEPTH hops). Every slot reached is appended to `reached`.
 */
function rowNode(row, depth, ctx) {
  const slots = coverageSlots(row, ctx.normalized);
  for (const s of slots) if (!ctx.reached.includes(s)) ctx.reached.push(s);
  const node = { variable: row.variable, class: row.class, slot: row.slot, slots };
  if (row.note) node.note = row.note;
  if (!row.via?.length) return node;
  node.via = [];
  if (depth >= EXPLAIN_MAX_VIA_DEPTH) { node.truncated = true; return node; }
  for (const name of row.via) {
    const next = ctx.byVariable.get(name);
    if (!next) { node.via.push({ variable: name, missing: true }); continue; }
    if (ctx.seen.has(name)) { node.via.push({ variable: name, seen: true }); continue; }
    ctx.seen.add(name);
    for (const r of next) node.via.push(rowNode(r, depth + 1, ctx));
  }
  return node;
}

/**
 * Reverse lookup: from a target variable to the slots it reads — the other
 * direction of `explainToken()` (`transtyle explain --variable`, issue #98).
 *
 * @param result `compile()`'s result (`normalized`, `results`) with the target compiled
 * @param target a target instance name (the config key, e.g. `shadcn-v3`)
 * @param variable the variable as the target's coverage rows name it; a name
 *   without its `$` is also tried as `$<name>` (Bootstrap's Sass variables)
 * @returns {{ target: string, variable: string, rows: object[], slots: string[] }}
 *   one node per coverage row of the variable: `{ variable, class, slot, slots,
 *   note?, via? }`, where `via` holds the nodes of the rows it follows, or
 *   `{ variable, missing: true }` (no row of that name: a variable the target
 *   leaves at its own default, or one only a summary row covers) or
 *   `{ variable, seen: true }`, and `truncated: true` marks the
 *   hop limit. `slots` lists every slot reached, in walk order; empty when the
 *   variable reads none (dropped, unsupported, exporter-private).
 * @throws Error with `code` `unknown-target` (`available`) or `unknown-variable` (`closest`)
 */
export function explainVariable(result, target, variable) {
  const { byVariable } = targetRows(result.results, target);
  const name = [variable, `$${variable}`].find((n) => byVariable.has(n));
  if (!name) {
    const closest = [...byVariable.keys()]
      .map((k) => [k, levenshtein(variable.replace(/^\$/, ''), k.replace(/^\$/, ''))])
      .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .slice(0, CLOSEST_COUNT)
      .map(([k]) => k);
    throw explainError('unknown-variable', `Unknown ${target} variable: ${variable}`, { target, variable, closest });
  }
  const ctx = { normalized: result.normalized, byVariable, seen: new Set([name]), reached: [] };
  const rows = byVariable.get(name).map((row) => rowNode(row, 0, ctx));
  return { target, variable: name, rows, slots: ctx.reached };
}

/**
 * Forward lookup: the target variables that consume a slot. A row reads it
 * directly (its slots name it) or through its `via` chain; `through` lists
 * the variables between the row and the one that names the slot.
 *
 * @param result `compile()`'s result with the target compiled
 * @param target a target instance name
 * @param slot a fully qualified slot path (as `explainToken()` returns it)
 * @returns {{ target: string, slot: string, rows: Array<{ variable, class, through: string[] }> }}
 *   direct rows first, then chained ones, each in the target's row order
 * @throws Error with `code` `unknown-target` (`available`)
 */
export function slotConsumers(result, target, slot) {
  const { rows, byVariable } = targetRows(result.results, target);
  const direct = [];
  const chained = [];
  const listed = new Set();
  // Breadth-first over `via`, so `through` is the shortest chain.
  const path = (row) => {
    const queue = [[row, []]];
    const seen = new Set([row.variable]);
    while (queue.length) {
      const [r, through] = queue.shift();
      if (coverageSlots(r, result.normalized).includes(slot)) return through;
      if (through.length >= EXPLAIN_MAX_VIA_DEPTH) continue;
      for (const name of r.via ?? []) {
        if (seen.has(name)) continue;
        seen.add(name);
        for (const next of byVariable.get(name) ?? []) queue.push([next, [...through, name]]);
      }
    }
    return null;
  };
  for (const row of rows) {
    const key = `${row.variable}\u0000${row.class}`;
    if (listed.has(key)) continue;
    const through = path(row);
    if (!through) continue;
    listed.add(key);
    (through.length ? chained : direct).push({ variable: row.variable, class: row.class, through });
  }
  return { target, slot, rows: [...direct, ...chained] };
}
