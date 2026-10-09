/**
 * The adoption report (issue #61): what a team's own vocabulary looks like
 * once it is bound to the catalog, read off the resolved graph.
 *
 * - `adoption(normalized)` — the custom `semantic.*` tokens (paths that are not
 *   catalog slots and not cells of a custom role), how many a catalog slot
 *   reads, and the unbound ones with hints. `transtyle check` prints it after
 *   the diagnostics and `check --json` carries it as `adoption`.
 * - `checkFalseFriends(normalized, diagnostics)` — TST1124 (info): a catalog
 *   slot bound to a token whose name is the slot's own word but whose value is
 *   what another ecosystem means by that word (language.md#false-friends).
 *
 * "Bound" follows the alias chain: `primary.solid → crt.ink → option.…` makes
 * `crt.ink` bound, and so does `slot → my.a → my.b` for `my.b`. Every mode
 * combination counts, since a mode layer can alias a different token. A
 * custom token no slot reads still reaches the targets that emit every token
 * verbatim (css-variables); per target, that loss is the coverage report's job.
 */

import { GRID_CELLS } from '@transtyle/ir';
import { catalog, compareSlotPaths, isCatalogSlot } from './catalog.js';
import { deltaEOK, DISTINGUISHABLE_DELTA_E } from './checks.js';

/** Two colours closer than this are "the same decision" for a hint or a false friend. */
export const ADOPTION_DELTA_E = DISTINGUISHABLE_DELTA_E;
/** Value hints per unbound token: enough to place it, few enough to read. */
const MAX_VALUE_HINTS = 3;

const isColor = (v) => v && typeof v === 'object' && typeof v.l === 'number' && typeof v.c === 'number';

/** Every distinct resolved map (`modes.light`/`dark` alias the combo maps). */
const comboMaps = (normalized) => (normalized.allCombos ?? Object.keys(normalized.modes)).map((key) => [key, normalized.modes[key]]);

/** The tokens an entry reads directly: its alias target and its composite members' targets. */
function readsOf(entry) {
  const prov = entry?.provenance;
  const out = [];
  if (prov?.kind === 'aliased' && prov.target) out.push(prov.target);
  for (const t of Object.values(prov?.members ?? {})) out.push(t);
  return out;
}

/** The alias chain below `path` in one map, in order, without `path` itself (cycles stop). */
function chainOf(map, path) {
  const out = [];
  const seen = new Set([path]);
  let entry = map.get(path);
  while (entry?.provenance?.kind === 'aliased' && entry.provenance.target && !seen.has(entry.provenance.target)) {
    const t = entry.provenance.target;
    out.push(t);
    seen.add(t);
    entry = map.get(t);
  }
  return out;
}

/** `semantic.color.crt-amber.tint` for a role declared with `$extensions.transtyle.role`. */
function isCustomRoleCell(normalized, path) {
  const segs = path.split('.');
  return segs.length === 4 && segs[0] === 'semantic' && segs[1] === 'color'
    && normalized.roleArchetypes.has(segs[2]) && GRID_CELLS.includes(segs[3]);
}

let slotList;
const slots = () => (slotList ??= catalog().slots.map(({ path, type }) => ({ path, type })));

/**
 * The name hint: a custom token that is a catalog slot with a middle part left
 * out (`semantic.color.surface` for `semantic.color.elevation.0.surface`,
 * `semantic.color.base` for `semantic.color.text.base`), of the same type. A
 * token under a group of its own (`brand.solid`) is not one: that group is a
 * name the slot doesn't have.
 */
function nameMatches(path, type) {
  const segs = path.split('.');
  const leaf = segs.at(-1);
  const parent = segs.slice(0, -1).join('.') + '.';
  return slots().filter((s) => s.path !== path && s.path.endsWith(`.${leaf}`) && s.path.startsWith(parent)
    && (type === undefined || s.type === undefined || s.type === type));
}

/** How a catalog slot gets its value in `map`: authored, bound (with the token it aliases), derived, defaulted. */
function bindingOf(map, slot) {
  const prov = map.get(slot)?.provenance;
  if (prov?.kind === 'aliased') return { binding: 'bound', via: prov.target };
  return { binding: prov?.kind ?? 'derived' };
}

/**
 * Value hints: catalog slots whose default-mode value is (nearly) this token's,
 * split into the ones the project set (authored or bound) and the ones the
 * engine filled (derived or defaulted).
 */
function valueHints(map, path, entry) {
  if (entry?.value === undefined) return { set: [], filled: [] };
  const found = [];
  for (const { path: slot } of slots()) {
    const other = map.get(slot);
    if (!other || other.value === undefined || other.type !== entry.type) continue;
    if (isColor(entry.value)) {
      if (!isColor(other.value)) continue;
      const d = deltaEOK(entry.value, other.value);
      if (d >= ADOPTION_DELTA_E) continue;
      found.push({ slot, match: 'value', deltaE: Math.round(d * 1000) / 1000, ...bindingOf(map, slot) });
    } else if (JSON.stringify(other.value) === JSON.stringify(entry.value)) {
      found.push({ slot, match: 'value', deltaE: 0, ...bindingOf(map, slot) });
    }
  }
  // Closest first; at equal distance a slot the project set (authored or bound)
  // before one the engine filled, since that is the decision the token repeats.
  const rank = (h) => (h.binding === 'authored' || h.binding === 'bound' ? 0 : 1);
  found.sort((a, b) => a.deltaE - b.deltaE || rank(a) - rank(b) || compareSlotPaths(a.slot, b.slot));
  return { set: found.filter((h) => rank(h) === 0), filled: found.filter((h) => rank(h) === 1) };
}

/**
 * The adoption report, as plain JSON-safe data:
 * `{ custom, bound, unbound: [{ path, type, hints }], roles: [{ role, archetype, cells }] }`.
 * `custom` and `bound` are counts; `unbound` is in path order. Each hint is
 * `{ slot, match: 'value', deltaE, binding, via? }` (default mode) or
 * `{ slot, match: 'name', others }` (`others`: how many more slots end the same way).
 */
export function adoption(normalized) {
  const maps = comboMaps(normalized).map(([, m]) => m).filter(Boolean);
  const isReader = (p) => isCatalogSlot(p) || isCustomRoleCell(normalized, p);

  const custom = new Set();
  const reached = new Set();
  for (const map of new Set(maps)) {
    for (const path of map.keys()) {
      if (path.startsWith('semantic.') && !isReader(path)) custom.add(path);
    }
    for (const [path, entry] of map) {
      if (!isReader(path)) continue;
      const stack = readsOf(entry);
      while (stack.length) {
        const t = stack.pop();
        if (reached.has(t)) continue;
        reached.add(t);
        stack.push(...readsOf(map.get(t)));
      }
    }
  }

  const base = normalized.modes[normalized.defaultMode];
  const unbound = [...custom].filter((p) => !reached.has(p)).sort(compareSlotPaths).map((path) => {
    const entry = base?.get(path) ?? maps.map((m) => m.get(path)).find(Boolean);
    // The name hint first: a token that shadows a slot's name is most likely
    // a slot authored at the wrong path, whatever its colour. Then the slots
    // the project set to the same value; the ones the engine filled only when
    // there is nothing else to go on, since they mostly repeat a decision.
    const hints = [];
    const [first, ...rest] = nameMatches(path, entry?.type);
    if (first) hints.push({ slot: first.path, match: 'name', others: rest.length });
    const { set, filled } = base ? valueHints(base, path, entry) : { set: [], filled: [] };
    hints.push(...(set.length || first ? set : filled).slice(0, MAX_VALUE_HINTS));
    return { path, ...(entry?.type ? { type: entry.type } : {}), hints };
  });

  const roles = [...normalized.roleArchetypes].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([role, archetype]) => ({
    role,
    archetype,
    cells: GRID_CELLS.filter((c) => base?.has(`semantic.color.${role}.${c}`)).length,
  }));

  return { custom: custom.size, bound: custom.size - unbound.length, unbound, roles };
}

/**
 * The false friends a binding can be checked for, one row per word of the
 * language reference's table (website/src/docs/language.md#false-friends):
 * the catalog slot named by the word, and the cells that hold what the other
 * ecosystem means by it. A binding is flagged only when both signals agree: a
 * token on the slot's alias chain is named with the word, and the value is
 * within ΔE 0.05 of one of those cells. Either alone is a legitimate system
 * (Bootstrap's `$secondary` is a mid gray close to `neutral.solid`, a real
 * second brand colour is near nothing). `muted`, `outline`, `subtle` and
 * `selected` have no value signal or no slot of that name, so no row.
 */
const FALSE_FRIENDS = [
  {
    word: 'secondary',
    slot: 'semantic.color.secondary.solid',
    // shadcn's --secondary is our neutral.tint.
    cells: ['semantic.color.neutral.tint'],
    means: "shadcn's --secondary, a subtle gray surface (our neutral.tint), not a second brand colour",
    hint: 'Bind neutral.tint to that token instead and leave secondary.solid derived, or bind secondary.solid to your second brand colour.',
  },
  {
    word: 'accent',
    slot: 'semantic.color.accent.solid',
    // shadcn's --accent is our accent.tint: the tint accent derives to
    // (primary.tint, accent derives from primary), or the gray wash shadcn's
    // stock themes give it (the same value as their --secondary).
    cells: ['semantic.color.primary.tint', 'semantic.color.neutral.tint'],
    means: "shadcn's --accent, a hover-highlight wash (our accent.tint), not a brand emphasis colour",
    hint: 'Bind accent.tint to that token instead and leave accent.solid derived, or bind accent.solid to your emphasis colour.',
  },
];

const short = (p) => p.replace(/^semantic\.color\./, '').replace(/^semantic\./, '');

/** TST1124 (info): a binding that reads the slot's word with another ecosystem's meaning. */
export function checkFalseFriends(normalized, diagnostics) {
  for (const row of FALSE_FRIENDS) {
    let best = null;
    for (const [mode, map] of comboMaps(normalized)) {
      if (!map) continue;
      const entry = map.get(row.slot);
      if (entry?.provenance?.kind !== 'aliased' || !isColor(entry.value)) continue;
      const named = chainOf(map, row.slot).find((p) => p.split(/[.-]/).includes(row.word));
      if (!named) continue;
      for (const cell of row.cells) {
        const other = map.get(cell)?.value;
        if (!isColor(other)) continue;
        const d = deltaEOK(entry.value, other);
        if (d < ADOPTION_DELTA_E && (!best || d < best.d)) best = { d, cell, mode, named };
      }
    }
    if (!best) continue;
    diagnostics.info(
      'TST1124',
      `${short(row.slot)} is bound to ${short(best.named)}, ΔE ${best.d.toFixed(3)} from ${short(best.cell)} in ${best.mode} mode: that is ${row.means}`,
      { path: row.slot, hint: row.hint },
    );
  }
}
