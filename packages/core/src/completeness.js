/**
 * Authoring completeness levels (docs/architecture/derivation.md "Completeness
 * levels", issue #67): which catalog slots a design system should author next,
 * in the order they pay off, as data.
 *
 * Three levels, each extending the one before:
 *
 * - `minimal`: the brand color, the one input the engine cannot invent.
 * - `recommended`: the neutrals (page and card backgrounds, text, border),
 *   their values for every non-default `color-scheme`, radius and fonts. What
 *   `transtyle init --preset recommended` scaffolds.
 * - `complete`: the second brand color, the status roles, focus ring and
 *   scrim, and the spacing, type and control scales.
 *
 * "Authored" means a value the design system chose: provenance `authored` or
 * `aliased` (a binding to the team's own vocabulary is a choice too). Anything
 * else is a to-do item in one of four states: `missing` (no value at all: the
 * slot has no rule and nobody authored it), `derived`, `defaulted`, or
 * `carried-over` (a non-default color-scheme reuses the default one's value,
 * the same test as TST1204: see `carriesOver` in normalize.js).
 *
 * A family (`semantic.type.*`) is one item: an authored scale anchor is the
 * decision, the engine fills the rest. It is satisfied when at least one of
 * its catalog members is authored; its members are read off `catalog()`, so a
 * slot added to the catalog joins its family without being listed here.
 *
 * Profile names are not catalog vocabulary. Every slot named here must be a
 * catalog slot, and every family must have members: `check:grid` enforces it.
 */

import { comboKey } from '@transtyle/ir';
import { catalog } from './catalog.js';
import { carriesOver } from './normalize.js';

export const COMPLETENESS_LEVELS = ['minimal', 'recommended', 'complete'];
export const DEFAULT_COMPLETENESS_LEVEL = 'recommended';
/** `derivation.require` entries of the form `completeness:<level>` expand to a level's items. */
export const COMPLETENESS_REQUIRE_PREFIX = 'completeness:';

const SCHEME = 'color-scheme';

/**
 * The items, in to-do order. `scheme: 'other'` repeats the slot once for every
 * non-default `color-scheme` value the config declares (none declared, or only
 * one value: the item does not apply). `family` names a path prefix.
 */
const NEUTRALS = [
  ['semantic.color.elevation.0.surface', 'the page background: text, on-colors and contrast checks are measured against it'],
  ['semantic.color.elevation.1.surface', 'cards and panels'],
  ['semantic.color.text.base', 'body text'],
  ['semantic.color.text.muted', 'secondary text'],
  ['semantic.color.border', 'the default border: no rule fills it, so the targets that read it go without'],
];

const STATUS = [['success', 'success'], ['warning', 'warning'], ['danger', 'error and destructive'], ['info', 'informational']];

const ITEMS = [
  { level: 'minimal', slot: 'semantic.color.primary.solid', reason: 'your brand color: the one input the engine cannot invent, and the anchor of every derived color' },
  ...NEUTRALS.map(([slot, reason]) => ({ level: 'recommended', slot, reason })),
  ...NEUTRALS.map(([slot]) => ({ level: 'recommended', slot, scheme: 'other', reason: 'a value chosen for this color scheme, not the one the default scheme gets' })),
  { level: 'recommended', slot: 'semantic.radius.md', reason: 'the corner radius the whole radius scale is built from: without it the scale is left out' },
  { level: 'recommended', slot: 'semantic.font.sans', reason: 'the interface font: without it every target keeps its own' },
  { level: 'recommended', slot: 'semantic.font.mono', reason: 'the code font: without it every target keeps its own' },
  { level: 'complete', slot: 'semantic.color.secondary.solid', reason: 'the second brand color, if your brand has one' },
  ...STATUS.map(([role, what]) => ({ level: 'complete', slot: `semantic.color.${role}.solid`, reason: `the ${what} color` })),
  { level: 'complete', slot: 'semantic.color.ring', reason: 'the focus ring keyboard users follow' },
  { level: 'complete', slot: 'semantic.color.scrim', reason: 'the backdrop behind dialogs and drawers' },
  { level: 'complete', family: 'semantic.space', reason: 'the spacing scale' },
  { level: 'complete', family: 'semantic.type', reason: 'the type scale' },
  { level: 'complete', family: 'component.control', reason: 'the padding and radius buttons and fields share' },
];

const levelIndex = (level) => COMPLETENESS_LEVELS.indexOf(level);

/** The items of `level` (its own and every lower level's), in to-do order. */
function itemsOf(level) {
  const max = levelIndex(level);
  if (max < 0) throw new Error(`Unknown completeness level "${level}". Valid: ${COMPLETENESS_LEVELS.join(', ')}.`);
  return ITEMS.filter((i) => levelIndex(i.level) <= max);
}

/** Catalog members of a family prefix, in catalog (path) order. */
function familyMembers(prefix, slots) {
  return slots.filter((s) => s.path.startsWith(`${prefix}.`)).map((s) => s.path);
}

/**
 * The levels as data, for docs and tools: `[{ name, items: [{ slot, scheme?,
 * members?, reason, level }] }]`, families expanded to their catalog members.
 */
export function completenessLevels() {
  const slots = catalog().slots;
  return COMPLETENESS_LEVELS.map((name) => ({
    name,
    items: itemsOf(name).map((i) => ({
      level: i.level,
      slot: i.family ? `${i.family}.*` : i.slot,
      ...(i.scheme ? { scheme: i.scheme } : {}),
      ...(i.family ? { members: familyMembers(i.family, slots) } : {}),
      reason: i.reason,
    })),
  }));
}

const AUTHORED = new Set(['authored', 'aliased']);

/** `missing` | `derived` | `defaulted` | `authored` for one entry (aliased counts as authored). */
function stateOf(entry) {
  const kind = entry?.provenance?.kind;
  if (entry === undefined || entry.value === undefined || kind === undefined) return 'missing';
  return AUTHORED.has(kind) ? 'authored' : kind;
}

/**
 * Where an item is checked: the all-defaults combination, plus, for a
 * `scheme: 'other'` item, the combination with `color-scheme` at each
 * non-default value (every other dimension at its default).
 */
function placesOf(item, normalized) {
  const defaults = Object.fromEntries(normalized.dimensionNames.map((d) => [d, normalized.dimensions[d].default]));
  const base = normalized.modes[comboKey(normalized.dimensionNames, defaults)];
  if (item.scheme !== 'other') return [{ map: base }];
  const dim = normalized.dimensions[SCHEME];
  if (!dim) return [];
  return dim.values
    .filter((v) => v !== dim.default)
    .map((v) => ({ map: normalized.modes[comboKey(normalized.dimensionNames, { ...defaults, [SCHEME]: v })], base, scheme: v }));
}

/**
 * The state of every item of `level` against a normalized design system (the
 * `normalized` that `compile()` returns), in to-do order:
 *
 * `{ level, authored, total, items: [{ slot, state, mode?, rule?, reason, authoredMembers?, members? }], todo }`
 *
 * `todo` is `items` without the authored ones. `mode` is `color-scheme=<value>`
 * on a per-scheme item; `rule` is the rule that filled a derived or defaulted
 * slot, named as `catalog()` names it. `authored`/`total` count items, not
 * slots: a family is one item. Pure and deterministic: no config, no
 * filesystem. An unknown level throws.
 */
export function completenessStatus(normalized, level = DEFAULT_COMPLETENESS_LEVEL) {
  const slots = catalog().slots;
  const items = [];
  for (const item of itemsOf(level)) {
    for (const { map, base, scheme } of placesOf(item, normalized)) {
      const out = { slot: item.family ? `${item.family}.*` : item.slot };
      if (scheme) out.mode = `${SCHEME}=${scheme}`;
      if (item.family) {
        const members = familyMembers(item.family, slots);
        const states = members.map((m) => stateOf(map.get(m)));
        const authoredMembers = states.filter((s) => s === 'authored').length;
        // Unauthored, a family reads as its members do: derived when any member
        // derives, else defaulted when any defaults, else missing.
        out.state = authoredMembers > 0 ? 'authored' : ['derived', 'defaulted'].find((s) => states.includes(s)) ?? 'missing';
        out.authoredMembers = authoredMembers;
        out.members = members.length;
      } else {
        const entry = map.get(item.slot);
        out.state = stateOf(entry);
        // Without the rule pack suffix, as `catalog()` names rules: `hue-anchor(150)`.
        if (out.state === 'derived' || out.state === 'defaulted') out.rule = entry.provenance.rule?.replace(/@[^@()]+@\d+$/, '') ?? null;
        if (scheme && out.state === 'authored' && carriesOver(entry, base.get(item.slot), scheme)) out.state = 'carried-over';
      }
      out.reason = item.reason;
      items.push(out);
    }
  }
  const authored = items.filter((i) => i.state === 'authored').length;
  return { level, authored, total: items.length, items, todo: items.filter((i) => i.state !== 'authored') };
}
