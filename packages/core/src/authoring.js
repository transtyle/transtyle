/**
 * Authoring checks (issue #93): values that compile without error but ship
 * something other than what the author wrote. Run from runChecks, once every
 * alias has a value (docs/specs/validation-and-coverage.md).
 */

import { formatColor, formatHex } from './color.js';
import { ORDERED_SCALES } from './derive.js';
import { remBaseOf } from './units.js';

/** The token an aliased entry ends up pointing at, following the chain to its end. */
export function aliasRoot(map, path) {
  const seen = new Set();
  let target = null;
  let entry = map.get(path);
  while (entry?.provenance?.kind === 'aliased' && entry.provenance.target && !seen.has(entry.provenance.target)) {
    target = entry.provenance.target;
    seen.add(target);
    entry = map.get(target);
  }
  return target;
}

const isColor = (v) => v && typeof v === 'object' && typeof v.l === 'number' && typeof v.c === 'number';
const AUTHORED = new Set(['authored', 'aliased']);

/** Every distinct resolved map (`modes.light`/`dark` alias the combo maps). */
const comboMaps = (normalized) => (normalized.allCombos ?? Object.keys(normalized.modes)).map((key) => [key, normalized.modes[key]]);

const sample = (items, n = 3) => (items.length > n ? `${items.slice(0, n).join(', ')}, …` : items.join(', '));

/**
 * TST1120 (info): an authored colour that a slot reaches is outside sRGB. The
 * targets that write hex or HSL clamp it, and each reports the clamp as an
 * `approximated` row. The predicate is formatHex's own `clamped`, so this
 * diagnostic and the exporters' `approximated` rows always agree. Reported once per
 * authored source token and value; derived colours are out of scope (they are
 * not an authoring decision), and so are option tokens no slot reaches (#62).
 */
export function checkOutOfGamut(normalized, diagnostics) {
  const found = new Map();
  for (const [, map] of comboMaps(normalized)) {
    for (const [path, entry] of map) {
      if (!path.startsWith('semantic.') && !path.startsWith('component.')) continue;
      if (!AUTHORED.has(entry.provenance?.kind) || !isColor(entry.value)) continue;
      const source = entry.provenance.kind === 'aliased' ? aliasRoot(map, path) : path;
      const src = source && map.get(source);
      if (src?.provenance?.kind !== 'authored' || !isColor(src.value)) continue;
      const { text: hex, clamped } = formatHex(src.value);
      if (!clamped) continue;
      // The value as authored: a CSS string, or a DTCG color object written back as JSON.
      const raw = typeof src.rawValue === 'string' ? src.rawValue : src.rawValue && typeof src.rawValue === 'object' ? JSON.stringify(src.rawValue) : formatColor(src.value);
      const key = `${source} ${raw}`;
      if (!found.has(key)) found.set(key, { source, raw, hex, slots: new Set() });
      if (path !== source) found.get(key).slots.add(path);
    }
  }
  for (const { source, raw, hex, slots } of found.values()) {
    const used = [...slots].sort();
    diagnostics.info(
      'TST1120',
      `${source} = ${raw} is outside sRGB${used.length ? ` (used by ${sample(used)})` : ''}`,
      {
        hint: `Targets that write hex or HSL ship ${hex}; targets that write oklch() keep your colour. Author an in-gamut value to choose the fallback yourself.`,
        hex,
        ...(used.length ? { slots: used } : {}),
      },
    );
  }
}

/** A comparable magnitude for a scale value: lengths in px (rem at the config's `units.remBase`), times in ms. Anything else is null. */
function magnitude(value, remBase) {
  const m = /^(-?\d*\.?\d+)(px|rem|ms|s)$/.exec(String(value).trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (m[2] === 'rem') return { dim: 'length', n: n * remBase };
  if (m[2] === 'px') return { dim: 'length', n };
  return { dim: 'time', n: m[2] === 's' ? n * 1000 : n };
}

const short = (path) => path.replace(/^semantic\./, '');

/**
 * TST1121 (warning): a partially authored scale whose catalog defaults make
 * the shipped scale wrong. Two shapes, both silent before:
 *
 * - inversion: a defaulted rung is out of order with an authored neighbour
 *   (`space.4 = 2rem` authored, `space.5 = 1.25rem` default). Compared in px
 *   (rem at `units.remBase`, 16px by default) or ms; `em`, `%`, `calc()` and mixed units are skipped.
 * - renamed scale: the group has authored tokens and none of them is a
 *   catalog rung, so every rung any target reads is a default.
 *
 * A partial scale that stays in order (one rung tuned) is silent, and so is a
 * group nobody authored. One diagnostic per group; the mode is named only when
 * the finding does not hold in every mode combination.
 */
export function checkPartialScales(normalized, config, diagnostics) {
  const remBase = remBaseOf(config);
  const maps = comboMaps(normalized);
  const findings = new Map(); // message -> { hint, modes: [] }
  const record = (message, hint, mode) => {
    if (!findings.has(message)) findings.set(message, { hint, modes: [] });
    findings.get(message).modes.push(mode);
  };
  for (const [mode, map] of maps) {
    for (const [group, rungs] of Object.entries(ORDERED_SCALES)) {
      const prefix = `${group}.`;
      const kindOf = (rung) => map.get(prefix + rung)?.provenance?.kind;
      const defaulted = rungs.filter((r) => kindOf(r) === 'defaulted');
      if (!defaulted.length) continue;
      const authoredRungs = rungs.filter((r) => AUTHORED.has(kindOf(r)));

      if (!authoredRungs.length) {
        const own = [];
        for (const [path, entry] of map) {
          if (path.startsWith(prefix) && AUTHORED.has(entry.provenance?.kind)) own.push(short(path));
        }
        if (own.length) {
          record(
            `${short(group)} has authored tokens (${sample(own.sort())}) but none of the catalog's rungs, so targets get a catalog default for every rung`,
            `Targets read only the catalog rungs ${short(group)}.{${rungs.join(', ')}}. Author those names, or alias them to yours (${prefix}${rungs[Math.floor(rungs.length / 2)]} = {semantic.${own[0]}}).`,
            mode,
          );
        }
        continue;
      }

      const inversions = [];
      for (let i = 0; i + 1 < rungs.length; i++) {
        const [a, b] = [rungs[i], rungs[i + 1]];
        const [ka, kb] = [kindOf(a), kindOf(b)];
        const mixed = (AUTHORED.has(ka) && kb === 'defaulted') || (ka === 'defaulted' && AUTHORED.has(kb));
        if (!mixed) continue;
        const va = map.get(prefix + a).value;
        const vb = map.get(prefix + b).value;
        const [ma, mb] = [magnitude(va, remBase), magnitude(vb, remBase)];
        if (!ma || !mb || ma.dim !== mb.dim || ma.n <= mb.n) continue;
        const label = (k) => (k === 'defaulted' ? 'catalog default' : 'authored');
        inversions.push(`${short(prefix + a)} = ${va} (${label(ka)}) > ${short(prefix + b)} = ${vb} (${label(kb)})`);
      }
      if (inversions.length) {
        const more = inversions.length - 1;
        record(
          `${short(group)} is out of order: ${inversions[0]}${more ? ` (and ${more} more pair${more > 1 ? 's' : ''})` : ''}`,
          `Only part of the scale is authored, and catalog defaults fill the rest (${sample(defaulted.map((r) => `${short(group)}.${r}`), 4)}). Author the whole scale, or rescale the authored rungs to fit between the defaults.`,
          mode,
        );
      }
    }
  }
  for (const [message, { hint, modes }] of findings) {
    const everywhere = modes.length === maps.length;
    diagnostics.warn('TST1121', everywhere ? message : `${message} in ${modes.join(', ')} mode`, { hint });
  }
}
