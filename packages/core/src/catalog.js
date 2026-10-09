/**
 * catalog() — the semantic contract as data (docs/architecture/ir.md#the-semantic-contract,
 * docs/specs/cli.md `transtyle catalog`).
 *
 * Every slot the engine guarantees or reads, with its DTCG type, how it gets a
 * value when unauthored (rule and inputs), and which optional anchor it needs.
 *
 * It is read off the engine, not written next to it: a **probe compile** runs
 * NORMALIZE + DERIVE in memory on a built-in design system that authors every
 * anchor with a placeholder value, in light and dark, and reads each slot's
 * path, type and provenance. A rule added to derive.js shows up here without
 * anyone remembering to list it, and a catalog that says a slot derives one
 * way while the engine does another cannot happen. Rule names and inputs are
 * the same in both modes (checked below), and placeholder values never reach
 * the output: only paths, types, rule names and inputs do. So the result is
 * the same, byte for byte, on every run and every machine.
 *
 * Which anchor a conditional slot `requires` is learned the same way: one more
 * probe per optional anchor, with that anchor left out; the slots that vanish
 * need it, and an anchor the engine fills anyway (`text.base`) takes its kind
 * and rule from that probe. `semantic.color.primary.solid` is the engine's one required input
 * (TST1201) and is never left out: every derived slot depends on it.
 *
 * No filesystem, no config, no exporter: the catalog is a property of the IR
 * spec and the rule pack, not of a project. Custom roles and custom semantic
 * tokens a project adds are its own vocabulary, not the catalog's.
 */

import { IR_SPEC, COLOR_ROLES, GRID_CELLS, PROVENANCE } from '@transtyle/ir';
import { normalize, resolveDeferredAliases } from './normalize.js';
import { derive } from './derive.js';
import { Diagnostics } from './diagnostics.js';

const RULE_PACK = 'standard@1';

/**
 * The anchors the probe authors: the slots no rule fills, and the two neutral
 * anchors the engine only defaults. Placeholder values, chosen only to be
 * valid; nothing about them reaches the catalog. `primary.solid` is required;
 * every other one is optional and probed for. The page is authored so the
 * dark probe reads the same rules as the light one: a modeless `text.base`
 * on an unauthored page is swapped in dark (`swap-neutrals`, a rule of the
 * pair, not of either slot), and the probe without the page reads only light.
 */
const ANCHORS = {
  'semantic.color.primary.solid': { $type: 'color', $value: 'oklch(0.55 0.18 255)' },
  'semantic.color.elevation.0.surface': { $type: 'color', $value: 'oklch(1 0 0)' },
  'semantic.color.text.base': { $type: 'color', $value: 'oklch(0.2 0.01 255)' },
  'semantic.color.border': { $type: 'color', $value: 'oklch(0.9 0.005 255)' },
  'semantic.radius.md': { $type: 'dimension', $value: '0.5rem' },
  'semantic.font.sans': { $type: 'fontFamily', $value: ['system-ui', 'sans-serif'] },
  'semantic.font.mono': { $type: 'fontFamily', $value: ['ui-monospace', 'monospace'] },
  'semantic.font.display': { $type: 'fontFamily', $value: ['Georgia', 'serif'] },
  'component.tooltip.max-width': { $type: 'dimension', $value: '200px' },
};
const REQUIRED_ANCHOR = 'semantic.color.primary.solid';

const PROBE_CONFIG = {
  modes: { 'color-scheme': { values: ['light', 'dark'], default: 'light' } },
  derivation: { rules: RULE_PACK },
};

/** One NORMALIZE + DERIVE pass over the anchors in `paths`. Returns the light and dark maps. */
function probe(paths) {
  const tree = {};
  for (const p of paths) {
    const segs = p.split('.');
    let node = tree;
    for (const s of segs.slice(0, -1)) node = node[s] ??= {};
    node[segs.at(-1)] = structuredClone(ANCHORS[p]);
  }
  const diagnostics = new Diagnostics();
  const normalized = normalize([{ file: '(catalog probe)', tree }], PROBE_CONFIG, diagnostics);
  derive(normalized, PROBE_CONFIG, diagnostics);
  resolveDeferredAliases(normalized, diagnostics);
  if (diagnostics.errors.length) {
    throw new Error(`catalog probe failed: ${diagnostics.errors.map((d) => `${d.code} ${d.message}`).join('; ')}`);
  }
  return { light: normalized.modes.light, dark: normalized.modes.dark };
}

/**
 * Path order: segment by segment, numbers as numbers, so `space.2` comes
 * before `space.10` and `elevation.0` before `elevation.1`. Plain code-unit
 * comparison otherwise: no locale, so no machine-dependent order.
 */
export function compareSlotPaths(a, b) {
  const as = a.split('.');
  const bs = b.split('.');
  for (let i = 0; i < Math.min(as.length, bs.length); i++) {
    if (as[i] === bs[i]) continue;
    const an = /^\d+$/.test(as[i]);
    const bn = /^\d+$/.test(bs[i]);
    if (an && bn) return Number(as[i]) - Number(bs[i]);
    if (an !== bn) return an ? -1 : 1;
    return as[i] < bs[i] ? -1 : 1;
  }
  return as.length - bs.length;
}

/** `semantic.color.primary.tint` → role; `semantic.color.text.muted` → text; `semantic.space.4` → space; `component.button.radius` → button. */
function groupOf(path) {
  const [tier, second, third] = path.split('.');
  if (tier === 'component') return second;
  if (second === 'color') return COLOR_ROLES.includes(third) ? 'role' : third;
  return second;
}

/**
 * A provenance input is recorded relative (`primary.solid`, `radius.md`,
 * `control.radius`); the catalog gives full paths, tried in the same order
 * `transtyle explain` resolves them.
 */
function qualify(input, known) {
  for (const candidate of [input, `semantic.${input}`, `semantic.color.${input}`, `component.${input}`]) {
    if (known.has(candidate)) return candidate;
  }
  throw new Error(`catalog: rule input "${input}" names no catalog slot`);
}

const stripPack = (rule) => rule?.replace(`@${RULE_PACK}`, '') ?? null;
const ruleKey = (entry) => JSON.stringify([entry.provenance.kind, entry.provenance.rule ?? null, entry.provenance.inputs ?? []]);

function build() {
  const all = Object.keys(ANCHORS);
  const { light, dark } = probe(all);

  const paths = [...light.keys()].sort(compareSlotPaths);
  const darkPaths = [...dark.keys()].sort(compareSlotPaths);
  if (paths.join('\n') !== darkPaths.join('\n')) {
    throw new Error('catalog: the probe resolves a different slot set in light and dark');
  }
  for (const p of paths) {
    if (ruleKey(light.get(p)) !== ruleKey(dark.get(p))) {
      throw new Error(`catalog: ${p} is filled by a different rule in light and dark`);
    }
  }

  // requires: the optional anchor whose absence makes the slot vanish. And an
  // anchor the engine can fill too (`text.base`, defaulted from the canvas) is
  // described by the probe that leaves it out: authored, every slot reads as
  // authored, so that is the only way to see its rule.
  const requires = new Map(paths.map((p) => [p, []]));
  const filledWithout = new Map();
  for (const anchor of all) {
    if (anchor === REQUIRED_ANCHOR) continue;
    const without = probe(all.filter((a) => a !== anchor)).light;
    for (const p of paths) {
      if (p !== anchor && !without.has(p)) requires.get(p).push(anchor);
    }
    if (without.get(anchor)?.provenance.kind !== undefined) filledWithout.set(anchor, without.get(anchor));
  }

  const known = new Set(paths);
  const slots = paths.map((path) => {
    const entry = filledWithout.get(path) ?? light.get(path);
    const { kind, rule, inputs = [] } = entry.provenance;
    const tier = path.split('.')[0];
    const group = groupOf(path);
    const slot = {
      path,
      tier,
      group,
      type: entry.type,
      kind: kind === PROVENANCE.AUTHORED ? 'authored-only' : kind,
      rule: stripPack(rule),
      inputs: inputs.map((i) => qualify(i, known)),
      requires: requires.get(path).sort(compareSlotPaths),
    };
    if (group === 'role') {
      const [, , role, cell] = path.split('.');
      slot.role = role;
      slot.cell = cell;
    }
    return slot;
  });

  const count = (pred) => slots.filter(pred).length;
  return {
    irSpec: IR_SPEC,
    rulePack: RULE_PACK,
    counts: {
      slots: slots.length,
      semantic: count((s) => s.tier === 'semantic'),
      component: count((s) => s.tier === 'component'),
      derived: count((s) => s.kind === PROVENANCE.DERIVED),
      defaulted: count((s) => s.kind === PROVENANCE.DEFAULTED),
      authoredOnly: count((s) => s.kind === 'authored-only'),
    },
    // A custom role with `$extensions.transtyle.role` gets the same cells as a
    // built-in one (ir.md §archetypes), so these two lists are what a consumer
    // needs to expand the grid for a project's own roles.
    roles: [...COLOR_ROLES],
    cells: [...GRID_CELLS],
    slots,
  };
}

let cached;

/**
 * The catalog as a plain JSON-safe object: `{ irSpec, rulePack, counts,
 * roles, cells, slots }`, slots in path order. Each call returns a fresh copy,
 * so a caller may mutate it.
 */
export function catalog() {
  cached ??= build();
  return structuredClone(cached);
}
