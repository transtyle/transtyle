/** Built-in accessibility/consistency checks (docs/specs/validation-and-coverage.md). */

import { contrastRatio } from './color.js';
import { aliasRoot, checkOutOfGamut, checkPartialScales } from './authoring.js';

const S = 'semantic.color.';

/**
 * Two colors closer than this OKLab distance (ΔE_OK, the Euclidean distance CSS
 * Color 4 uses for gamut mapping) are reported as hard to tell apart (TST2102,
 * TST2103). 0.05 is 2.5x CSS Color 4's just-noticeable difference (0.02) and
 * stays under the derived palette's closest pair (0.082), so a derived system
 * never warns; see docs/worklog/2026-10-09-bl-18-distinguishability.md.
 */
export const DISTINGUISHABLE_DELTA_E = 0.05;

/** Euclidean distance in OKLab between two canonical OKLCH colors (no gamut mapping). */
export function deltaEOK(a, b) {
  const lab = ({ l, c, h }) => {
    const r = (h * Math.PI) / 180;
    return [l, c * Math.cos(r), c * Math.sin(r)];
  };
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/**
 * Group `items` ({ name, path, value }) into clusters of mutually-near colors:
 * the connected components of "closer than the threshold". A pair that aliases
 * one token is a stated intent and never links two items. Returns clusters of
 * two or more, each with its smallest distance.
 */
function nearClusters(items, map) {
  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const dist = new Map();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const ra = aliasRoot(map, items[i].path);
      if (ra !== null && ra === aliasRoot(map, items[j].path)) continue;
      const d = deltaEOK(items[i].value, items[j].value);
      if (d >= DISTINGUISHABLE_DELTA_E) continue;
      dist.set(`${i}|${j}`, d);
      parent[find(i)] = find(j);
    }
  }
  const groups = new Map();
  items.forEach((item, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  });
  const out = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    let min = Infinity;
    let minPair = null;
    for (const [key, d] of dist) {
      const [i, j] = key.split('|').map(Number);
      if (members.includes(i) && members.includes(j) && d < min) { min = d; minPair = [i, j]; }
    }
    out.push({ items: members.map((i) => items[i]), min, minPair: minPair.map((i) => items[i]) });
  }
  return out;
}

const list = (names) =>
  names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** TST2102 / TST2103: colors that must be told apart on a chart or a badge, and can't be. */
function checkDistinguishability(normalized, diagnostics) {
  const colorOf = (map, path) => {
    const v = map.get(path)?.value;
    return v && typeof v === 'object' && typeof v.l === 'number' ? v : null;
  };
  for (const mode of normalized.modeValues) {
    const map = normalized.modes[mode];

    const series = [];
    for (let n = 1; n <= 8; n++) {
      const path = `semantic.palette.categorical.${n}`;
      const value = colorOf(map, path);
      if (value) series.push({ name: `palette.categorical.${n}`, path, value });
    }
    for (const cluster of nearClusters(series, map)) {
      const names = cluster.items.map((i) => i.name);
      diagnostics.warn(
        'TST2102',
        cluster.items.length === 2
          ? `${names[0]} and ${names[1]} are ΔE ${cluster.min.toFixed(3)} apart in ${mode} mode (< ${DISTINGUISHABLE_DELTA_E})`
          : `${list(names)} are within ΔE ${DISTINGUISHABLE_DELTA_E} of each other in ${mode} mode (closest pair ${cluster.minPair[0].name} and ${cluster.minPair[1].name}, ΔE ${cluster.min.toFixed(3)})`,
        {
          hint: `Chart series using ${cluster.items.length === 2 ? 'these two entries' : 'any two of these'} can't be told apart. Author one of them as semantic.${cluster.items[cluster.items.length - 1].name}.`,
        },
      );
    }

    const roles = ['success', 'warning', 'danger', 'info'];
    for (const [role, archetype] of normalized.roleArchetypes) {
      if (archetype === 'status' && !roles.includes(role)) roles.push(role);
    }
    const status = [];
    for (const role of roles) {
      const path = `${S}${role}.solid`;
      const value = colorOf(map, path);
      if (value) status.push({ name: role, path, value });
    }
    for (const cluster of nearClusters(status, map)) {
      const names = cluster.items.map((i) => i.name);
      const identical = cluster.min === 0;
      const authored = cluster.items.every((i) => ['authored', 'aliased'].includes(map.get(i.path)?.provenance?.kind));
      diagnostics.warn(
        'TST2103',
        identical && cluster.items.every((i) => deltaEOK(i.value, cluster.items[0].value) === 0)
          ? `${list(names)} status roles resolve to the same color in ${mode} mode`
          : `${list(names)} status roles are within ΔE ${DISTINGUISHABLE_DELTA_E} of each other in ${mode} mode (closest pair ${cluster.minPair[0].name} and ${cluster.minPair[1].name}, ΔE ${cluster.min.toFixed(3)})`,
        {
          hint: authored
            ? `${list(names)} ${names.length > 1 ? 'are' : 'is'} authored or bound that way, so the source is where to fix it; Transtyle carries it through as written.`
            : `Author a distinct ${mode} .solid for at least ${names.length - 1} of them.`,
        },
      );
    }
  }
}

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
  checkHygiene(normalized, config, diagnostics);
  const min = contrastThreshold(config);
  const standard = config?.check?.contrast?.standard ?? 'wcag21-aa';
  for (const mode of normalized.modeValues) {
    const map = normalized.modes[mode];
    for (const [fg, bg] of CONTRAST_PAIRS) {
      const ratio = pairRatio(map, fg, bg);
      if (ratio === null) continue;
      if (ratio < min) {
        // AL5: on a design system with no dark-mode values authored, the
        // light values simply carry over — so a light-on-light pair is
        // flagged in dark mode and the warning looks like a mystery about
        // colors the user never wrote. When this mode's pair is byte-identical
        // to the default mode's, that carry-over IS the reason, and saying so
        // is the difference between an actionable warning and noise the user
        // learns to ignore.
        //
        // `derivation.autoDark` is NOT consulted here (or anywhere in the
        // pipeline): it's specced (derivation.md) but not implemented, so the
        // hint below must not suggest it as a working remedy — "opt into
        // autoDark" used to be here and was accurate-sounding but false.
        const defaultMap = normalized.modes[normalized.defaultMode];
        const carried =
          mode === normalized.defaultMode
            ? []
            : [fg, bg].filter(
                (p) =>
                  JSON.stringify(map.get(`${S}${p}`)?.value) ===
                  JSON.stringify(defaultMap?.get(`${S}${p}`)?.value),
              );
        diagnostics.warn(
          'TST2101',
          `${fg} vs ${bg} is ${ratio.toFixed(1)}:1 in ${mode} mode (< ${min}:1 ${standard})`,
          carried.length
            ? {
                hint: `${carried.join(' and ')} ${carried.length > 1 ? 'are' : 'is'} unchanged from ${normalized.defaultMode} mode — nothing authors a ${mode} value, so ${carried.length > 1 ? 'they' : 'it'} carried over. Author the ${mode} value.`,
              }
            : {},
        );
      }
    }
  }
  checkDistinguishability(normalized, diagnostics);
  checkOutOfGamut(normalized, diagnostics);
  checkPartialScales(normalized, config, diagnostics);
}

/** Epsilon for "the same colour written two ways": far below a visible difference. */
const EPS = { l: 1e-4, c: 1e-4, h: 0.05, alpha: 1e-4 };
/** Below this chroma the hue is meaningless (a gray has no hue). */
const ACHROMATIC = 1e-4;

/** Equality key for a value, or null if it can't be compared. Colors are bucketed, see sameColor. */
const isColor = (v) => v && typeof v === 'object' && typeof v.l === 'number' && typeof v.c === 'number';

function sameColor(a, b) {
  if (Math.abs(a.l - b.l) > EPS.l || Math.abs(a.c - b.c) > EPS.c) return false;
  if (Math.abs((a.alpha ?? 1) - (b.alpha ?? 1)) > EPS.alpha) return false;
  if (a.c < ACHROMATIC && b.c < ACHROMATIC) return true;
  const d = Math.abs(a.h - b.h) % 360;
  return Math.min(d, 360 - d) <= EPS.h;
}

function sameOptionValue(a, b) {
  if (isColor(a) || isColor(b)) return isColor(a) && isColor(b) && sameColor(a, b);
  return JSON.stringify(a) === JSON.stringify(b);
}

const HYGIENE_LEVELS = ['info', 'warning', 'off'];

/**
 * TST1114 / TST1115 (issue #62): option-layer hygiene, reported once per build.
 * Runs after every alias has a value, so the alias graph is complete. The
 * message carries the count and the first few paths; the full lists ride on
 * the diagnostic item (`paths`, `groups`) into `check --json` and report.json.
 */
function checkHygiene(normalized, config, diagnostics) {
  const level = (key) => {
    const v = config?.check?.hygiene?.[key] ?? 'info';
    return HYGIENE_LEVELS.includes(v) ? v : 'info';
  };
  const unusedLevel = level('unusedOption');
  const dupLevel = level('duplicateOption');
  if (unusedLevel === 'off' && dupLevel === 'off') return;
  const base = normalized.modes[normalized.defaultMode];
  if (!base) return;
  const options = [...base.entries()].filter(([p]) => p.startsWith('option.'));
  if (!options.length) return;
  const emit = (severity, code, message, ctx) =>
    severity === 'warning' ? diagnostics.warn(code, message, ctx) : diagnostics.info(code, message, ctx);
  const sample = (paths) => {
    const shown = paths.slice(0, 3).join(', ');
    return paths.length > 3 ? `${shown}, …` : shown;
  };

  if (unusedLevel !== 'off') {
    const used = new Set();
    const seen = new Set();
    for (const map of Object.values(normalized.modes)) {
      if (!map || seen.has(map)) continue; // modes.light/dark alias the combo maps
      seen.add(map);
      for (const entry of map.values()) {
        const prov = entry.provenance;
        if (prov?.kind === 'aliased' && prov.target) used.add(prov.target);
        for (const t of Object.values(prov?.members ?? {})) used.add(t);
      }
    }
    const unused = options.map(([p]) => p).filter((p) => !used.has(p));
    if (unused.length) {
      emit(
        unusedLevel,
        'TST1114',
        `${unused.length} option token${unused.length > 1 ? 's are' : ' is'} never referenced: ${sample(unused)}`,
        { hint: 'Alias them from a semantic or component token, or delete them. Nothing reads an option token directly.', paths: unused },
      );
    }
  }

  if (dupLevel !== 'off') {
    const groups = [];
    for (const [path, entry] of options) {
      if (entry.value === undefined) continue;
      const g = groups.find((x) => x.type === entry.type && sameOptionValue(x.value, entry.value));
      if (g) g.paths.push(path);
      else groups.push({ type: entry.type, value: entry.value, paths: [path] });
    }
    for (const g of groups.filter((x) => x.paths.length > 1)) {
      const [first, ...rest] = g.paths;
      emit(
        dupLevel,
        'TST1115',
        `${first} and ${rest.length} other option token${rest.length > 1 ? 's' : ''} resolve to the same value ${displayValue(g.value)}: ${sample(rest)}`,
        { hint: 'Keep one option token and alias the others to it, or give each a different value.', value: displayValue(g.value), paths: g.paths },
      );
    }
  }
}

function displayValue(v) {
  if (isColor(v)) {
    const f = (n) => +n.toFixed(4);
    return `oklch(${f(v.l)} ${f(v.c)} ${f(v.h ?? 0)}${v.alpha !== undefined && v.alpha !== 1 ? ` / ${f(v.alpha)}` : ''})`;
  }
  return typeof v === 'string' ? v : JSON.stringify(v);
}
