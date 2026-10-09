/**
 * LOAD: a Tokens Studio export as a token layer (`{ "tokensStudio": … }` in
 * `tokens`, docs/specs/configuration.md#tokens-studio-exports, ADR-0014).
 *
 * Tokens Studio for Figma exports DTCG-shaped JSON with a dialect of its own:
 * a folder of set files plus `$metadata.json` (set order) and `$themes.json`
 * (each theme = the sets it uses), or the same data as one file; its own type
 * names (`spacing`, `fontSizes`, `boxShadow`…); unitless pixel numbers; Figma
 * style names as font weights; percentages for line heights; math and
 * references inside strings; and, in older exports, `value`/`type` without the
 * `$`. This module reads all of that and returns ordinary layers: one base
 * layer (the themes mapped to every dimension's default) and one mode-scoped
 * layer per other mode value, exactly what a hand-written DTCG layout would
 * give the rest of the pipeline. Nothing in the export is modified on disk.
 *
 * What it does, in order:
 * 1. Read the sets, their order and the themes (TST1003 for a broken export).
 * 2. Per set: legacy keys to DTCG (TST1005), Tokens Studio types to DTCG types
 *    and their values to the forms values.js reads, color modifiers refused
 *    (TST1007, the plugin would output a different color).
 * 3. Place each set under a tier (`sets`, default `option`; a set already
 *    written under option/semantic/component is kept as is) and rewrite every
 *    reference to the placed path, `.value` suffixes dropped. A value that is
 *    math or holds references inside a string becomes an `Expression`,
 *    evaluated per mode in NORMALIZE.
 * 4. Map theme groups to mode dimensions (`themes`, TST1004 / TST1109), merge
 *    the active sets of every combination in set order (later wins, `source`
 *    sets before `enabled` ones, as Tokens Studio resolves them), and lower the
 *    result to a base layer plus per-mode overlays. Whatever that lowering
 *    cannot express is an error (TST1008), never a silently different theme;
 *    a token a non-default theme leaves out carries the default value over
 *    with a warning (TST1009).
 */

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { locateJson } from './locate.js';
import { Expression } from './expressions.js';
import { FONT_WEIGHT_KEYWORDS, plainNumber } from './values.js';
import { isStyleDictionaryLeaf } from './load.js';
import { needsStyleDictionaryMigration } from './migrate-style-dictionary.js';

const TIERS = new Set(['option', 'semantic', 'component']);

/** Tokens Studio `type` → DTCG `$type` (sd-transforms' align-types where it applies). */
const TYPES = {
  color: 'color',
  dimension: 'dimension',
  sizing: 'dimension',
  spacing: 'dimension',
  borderRadius: 'dimension',
  borderWidth: 'dimension',
  fontSizes: 'dimension',
  letterSpacing: 'dimension',
  paragraphSpacing: 'dimension',
  paragraphIndent: 'dimension',
  fontFamilies: 'fontFamily',
  fontWeights: 'fontWeight',
  lineHeights: 'number',
  opacity: 'number',
  boxShadow: 'shadow',
  typography: 'typography',
  border: 'border',
  strokeStyle: 'strokeStyle',
  number: 'number',
  // DTCG names, which a DTCG-format export may also use.
  fontFamily: 'fontFamily',
  fontWeight: 'fontWeight',
  shadow: 'shadow',
  duration: 'duration',
  cubicBezier: 'cubicBezier',
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const WHOLE_REF = /^\{[^{}]+\}$/;
const NUMERIC = /^-?(\d+\.?\d*|\.\d+)$/;
const MATH = /(\d|\))\s*[-+*/]\s*(\d|\(|\.)|\b(roundTo|min|max|floor|ceil|round)\(/;

// ---------- 1. reading the export ----------

async function readJson(file, rel, diagnostics, what) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (e) {
    diagnostics.error('TST1003', `Tokens Studio export ${rel}: cannot read ${what} (${e.code ?? e.message})`, {
      file: rel,
      hint: 'Point "tokensStudio" at the folder Tokens Studio syncs to (the one holding $metadata.json), or at a single-file export.',
    });
    return null;
  }
  try {
    return { json: JSON.parse(text), text };
  } catch (e) {
    diagnostics.error('TST1002', `Failed to parse ${rel}: ${e.message}`, { file: rel });
    return null;
  }
}

/**
 * The export as `{ sets: [{ name, file, tree, positions }], order, themes }`,
 * or null when it is unusable (already reported).
 */
async function readExport(cwd, source, diagnostics) {
  const abs = path.resolve(cwd, source);
  const rel = path.relative(cwd, abs);
  let info;
  try {
    info = await stat(abs);
  } catch {
    diagnostics.error('TST1003', `Tokens Studio export not found: ${rel}`, {
      hint: `Resolved relative to ${cwd}. Check "tokensStudio" in transtyle.config.json.`,
    });
    return null;
  }
  const invalid = (message, extra = {}) => diagnostics.error('TST1003', `Tokens Studio export ${rel}: ${message}`, extra);

  if (info.isDirectory()) {
    const meta = await readJson(path.join(abs, '$metadata.json'), path.join(rel, '$metadata.json'), diagnostics, '$metadata.json');
    if (!meta) return null;
    const order = meta.json?.tokenSetOrder;
    if (!Array.isArray(order) || !order.every((s) => typeof s === 'string')) {
      invalid('$metadata.json has no "tokenSetOrder" list of set names', { file: path.join(rel, '$metadata.json') });
      return null;
    }
    let themes = [];
    const themesFile = path.join(abs, '$themes.json');
    const hasThemes = await stat(themesFile).then(() => true, () => false);
    if (hasThemes) {
      const t = await readJson(themesFile, path.join(rel, '$themes.json'), diagnostics, '$themes.json');
      if (!t) return null;
      themes = t.json;
    }
    const sets = [];
    for (const name of order) {
      const file = path.join(rel, `${name}.json`);
      const r = await readJson(path.join(abs, `${name}.json`), file, diagnostics, `the file of set "${name}"`);
      if (!r) continue;
      if (!isPlainObject(r.json)) { invalid(`set "${name}" is not a JSON object`, { file }); continue; }
      const positions = locateJson(r.text);
      sets.push({ name, file, tree: r.json, at: (p) => positions.get(p) });
    }
    return { rel, order, themes, sets };
  }

  const r = await readJson(abs, rel, diagnostics, 'the file');
  if (!r) return null;
  if (!isPlainObject(r.json)) { invalid('not a JSON object'); return null; }
  const names = Object.keys(r.json).filter((k) => !k.startsWith('$'));
  const order = r.json.$metadata?.tokenSetOrder ?? names;
  if (!Array.isArray(order) || !order.every((s) => typeof s === 'string')) {
    invalid('"$metadata.tokenSetOrder" is not a list of set names', { file: rel });
    return null;
  }
  const positions = locateJson(r.text);
  const sets = [];
  for (const name of order) {
    if (!isPlainObject(r.json[name])) {
      invalid(`"$metadata.tokenSetOrder" lists set "${name}", which the file does not contain`, { file: rel });
      continue;
    }
    sets.push({ name, file: rel, tree: r.json[name], at: (p) => positions.get(p ? `${name}.${p}` : name) });
  }
  return { rel, order, themes: r.json.$themes ?? [], sets };
}

// ---------- 2. the dialect, per set ----------

/**
 * Legacy keys to DTCG ones (`value` → `$value`, `type` → `$type`,
 * `description` → `$description`), in place. What a legacy token is comes from
 * the Style Dictionary detection (TST1307, `migrate --from style-dictionary`);
 * the rest of that codemod does not apply: the types are Tokens Studio's (the
 * table above maps them) and tiers are placed per set.
 */
function legacyToDtcg(tree) {
  const walk = (node) => {
    if (!isPlainObject(node)) return;
    if (isStyleDictionaryLeaf(node)) {
      node.$value = node.value;
      delete node.value;
      for (const k of ['type', 'description']) {
        if (k in node) { node[`$${k}`] = node[k]; delete node[k]; }
      }
      return;
    }
    if ('type' in node && !isPlainObject(node.type)) { node.$type = node.type; delete node.type; }
    for (const [k, v] of Object.entries(node)) if (!k.startsWith('$')) walk(v);
  };
  walk(tree);
}

/** A unitless number (or a space-separated list of them) as px; everything else as authored. */
function px(v) {
  if (typeof v === 'number') return `${plainNumber(v)}px`;
  if (typeof v !== 'string' || v.includes('{') || MATH.test(v)) return v;
  const parts = v.trim().split(/\s+/);
  return parts.map((p) => (NUMERIC.test(p) ? `${plainNumber(Number(p))}px` : p)).join(' ');
}

const percent = (v) => (typeof v === 'string' && /^-?[\d.]+%$/.test(v.trim()) ? Number(v.trim().slice(0, -1)) / 100 : null);

function letterSpacing(v) {
  const p = percent(v);
  return p === null ? px(v) : `${plainNumber(Math.round(p * 1e4) / 1e4)}em`;
}

function lineHeight(v) {
  const p = percent(v);
  if (p !== null) return p;
  if (typeof v === 'string' && v.trim().toUpperCase() === 'AUTO') return 'normal';
  if (typeof v === 'string' && NUMERIC.test(v.trim())) return Number(v);
  return v;
}

function opacity(v) {
  const p = percent(v);
  if (p !== null) return p;
  if (typeof v === 'string' && NUMERIC.test(v.trim())) return Number(v);
  return v;
}

/**
 * A Figma style name (`Regular`, `Semi Bold`, `ExtraBold Italic`) to its
 * number, through the DTCG keyword table. `onItalic` is called when a style
 * also names an italic, which a weight cannot carry.
 */
function fontWeight(v, onItalic) {
  if (typeof v !== 'string' || v.includes('{')) return v;
  let s = v.trim().toLowerCase();
  if (NUMERIC.test(s)) return Number(s);
  if (/\b(italic|oblique)\b/.test(s)) {
    onItalic();
    s = s.replace(/\b(italic|oblique)\b/g, '').trim() || 'regular';
  }
  s = s.replace(/^(extra|ultra|semi|demi)\s*-?\s*/, '$1-').replace(/\s+/g, '-');
  return FONT_WEIGHT_KEYWORDS[s] ?? v;
}

const SHADOW_KEYS = { x: 'offsetX', y: 'offsetY', blur: 'blur', spread: 'spread' };

function shadowLayer(layer) {
  if (!isPlainObject(layer)) return layer;
  const out = {};
  for (const [k, v] of Object.entries(layer)) {
    if (k in SHADOW_KEYS) out[SHADOW_KEYS[k]] = px(v);
    else if (k === 'type') out.inset = v === 'innerShadow';
    else if (k === 'blendMode') continue; // no CSS box-shadow equivalent
    else out[k] = v;
  }
  return out;
}

/** Convert one token's value from its Tokens Studio type to the form its DTCG type reads. */
function convertValue(tsType, value, onItalic) {
  if (typeof value === 'string' && WHOLE_REF.test(value.trim())) return value;
  switch (tsType) {
    case 'dimension': case 'sizing': case 'spacing': case 'borderRadius': case 'borderWidth':
    case 'fontSizes': case 'paragraphSpacing': case 'paragraphIndent':
      return px(value);
    case 'letterSpacing': return letterSpacing(value);
    // A comma-separated family list as the DTCG array every exporter reads.
    case 'fontFamilies':
      return typeof value === 'string' && !value.includes('{') ? value.split(',').map((f) => f.trim()).filter(Boolean) : value;
    case 'fontWeights': return fontWeight(value, onItalic);
    case 'lineHeights': return lineHeight(value);
    case 'opacity': return opacity(value);
    case 'boxShadow': return Array.isArray(value) ? value.map(shadowLayer) : shadowLayer(value);
    case 'border':
      return isPlainObject(value) ? { ...value, ...('width' in value ? { width: px(value.width) } : {}) } : value;
    case 'typography': {
      if (!isPlainObject(value)) return value;
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        if (typeof v === 'string' && WHOLE_REF.test(v.trim())) { out[k] = v; continue; }
        if (k === 'fontSize' || k === 'paragraphSpacing' || k === 'paragraphIndent') out[k] = px(v);
        else if (k === 'letterSpacing') out[k] = letterSpacing(v);
        else if (k === 'lineHeight') out[k] = lineHeight(v);
        else if (k === 'fontWeight') out[k] = fontWeight(v, onItalic);
        else out[k] = v;
      }
      return out;
    }
    default:
      return value;
  }
}

/**
 * Types and values of every token of one set, in place. Calls `onToken(path,
 * node)` for each token, after conversion. Group-level `$type`s are pushed
 * down onto the tokens, so the layer never inherits a Tokens Studio type name.
 */
function convertSet(set, diagnostics, onToken) {
  const where = (p) => ({ file: set.file, ...(p ? { path: p } : {}), ...(set.at(p) ?? {}) });
  const walk = (node, keys, inherited) => {
    if (!isPlainObject(node)) return;
    const tsType = node.$type ?? inherited;
    if ('$value' in node) {
      const p = keys.join('.');
      const modifier = node.$extensions?.['studio.tokens']?.modify;
      if (modifier) {
        diagnostics.error(
          'TST1007',
          `${set.file}: ${p} uses a Tokens Studio color modifier (${modifier.type ?? 'unknown'}${modifier.value !== undefined ? ` ${modifier.value}` : ''}), which Transtyle does not apply — the theme would ship the unmodified color`,
          {
            ...where(p),
            hint: 'Remove the modifier and let derivation produce the state color (hover, active), or author the resulting color as the value.',
          },
        );
      }
      let italic = false;
      node.$value = convertValue(tsType, node.$value, () => { italic = true; });
      if (italic) {
        diagnostics.warn('TST1009', `${set.file}: ${p} names an italic font style, and a font weight cannot carry it — kept the weight only`, {
          ...where(p),
          hint: 'Put the italic in a typography token\'s fontStyle, or use a weight name without "Italic".',
        });
      }
      if (tsType !== undefined) node.$type = TYPES[tsType] ?? tsType;
      onToken(p, node);
      return;
    }
    if ('$type' in node) delete node.$type;
    for (const [k, v] of Object.entries(node)) {
      if (!k.startsWith('$')) walk(v, [...keys, k], tsType);
    }
  };
  walk(set.tree, [], undefined);
}

// ---------- 3. tiers and references ----------

const globRe = (pattern) => new RegExp(`^${pattern.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);

/** The tier a set is placed under, or null when it is already written under the tiers. */
function tierOf(set, sets) {
  const top = Object.keys(set.tree).filter((k) => !k.startsWith('$'));
  if (top.length > 0 && top.every((k) => TIERS.has(k))) return null;
  for (const [pattern, tier] of Object.entries(sets ?? {})) {
    if (globRe(pattern).test(set.name)) return tier;
  }
  return 'option';
}

const REF = /\{([^{}]+)\}/g;

/** Rewrite every reference in a value, recursing into composites; strings with math or inner references become Expressions. */
function rewriteValue(value, type, rewrite, inMember = false) {
  if (typeof value === 'string') {
    const text = value.replace(REF, (_, p) => `{${rewrite(p.trim())}}`);
    const trimmed = text.trim();
    if (WHOLE_REF.test(trimmed)) return text;
    if (trimmed.includes('{')) return new Expression(trimmed);
    if (type === 'color' && /^rgba?\(\s*#/i.test(trimmed)) return new Expression(trimmed);
    if (['dimension', 'number', 'fontWeight', 'duration'].includes(type) && MATH.test(trimmed) && !/^calc\(/i.test(trimmed)) {
      return new Expression(trimmed);
    }
    return text;
  }
  if (Array.isArray(value)) return value.map((v) => rewriteValue(v, type, rewrite, inMember));
  if (isPlainObject(value) && !inMember) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewriteValue(v, MEMBER_TYPES[type]?.[k], rewrite, true)]));
  }
  return value;
}

/** The DTCG type of each composite member, to know which member strings are math. */
const MEMBER_TYPES = {
  shadow: { color: 'color', offsetX: 'dimension', offsetY: 'dimension', blur: 'dimension', spread: 'dimension' },
  typography: { fontSize: 'dimension', fontWeight: 'fontWeight', letterSpacing: 'dimension', lineHeight: 'number', paragraphSpacing: 'dimension', paragraphIndent: 'dimension' },
  border: { color: 'color', width: 'dimension' },
};

// ---------- 4. themes and the lowering ----------

/** Theme groups, in order of first appearance: [{ name, themes: [theme] }]. */
function groupThemes(themes) {
  const groups = new Map();
  for (const t of themes) {
    const g = t.group ?? null;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(t);
  }
  return [...groups].map(([name, list]) => ({ name, themes: list }));
}

const groupLabel = (g) => (g.name === null ? 'the themes' : `theme group "${g.name}"`);

/**
 * Check the config's `themes` against the export's groups. Returns, per group,
 * `{ group, fixed }` or `{ group, dimension, map: [[theme, value]] }`, or null
 * when anything is wrong (reported).
 */
function resolveGroups(groups, spec, config, rel, diagnostics) {
  const err = (code, message, hint) => diagnostics.error(code, `Tokens Studio export ${rel}: ${message}`, hint ? { hint } : {});
  const ungrouped = groups.length === 1 && groups[0].name === null;
  const specFor = (g) => {
    if (ungrouped) return spec && ('dimension' in spec || 'fixed' in spec) ? spec : undefined;
    return spec?.[g.name];
  };
  const out = [];
  let ok = true;
  const usedDimensions = new Set();
  if (!ungrouped && spec) {
    for (const name of Object.keys(spec)) {
      if (!groups.some((g) => g.name === name)) {
        ok = false;
        err('TST1004', `"themes" maps group "${name}", which the export does not have (groups: ${groups.map((g) => g.name ?? '(no group)').join(', ')})`);
      }
    }
  }
  for (const g of groups) {
    const names = g.themes.map((t) => t.name);
    const s = specFor(g);
    if (!s) {
      ok = false;
      err(
        'TST1004',
        `${groupLabel(g)} (${names.join(', ')}) is not mapped`,
        ungrouped
          ? `Add "themes": { "dimension": "color-scheme", "map": { ${names.map((n) => `"${n}": "…"`).join(', ')} } } to the layer, or "themes": { "fixed": "${names[0]}" } to compile one theme only.`
          : `Add "${g.name}": { "dimension": "…", "map": { … } } (one mode value per theme) or "${g.name}": { "fixed": "${names[0]}" } under the layer's "themes".`,
      );
      continue;
    }
    if (s.fixed !== undefined) {
      const theme = g.themes.find((t) => t.name === s.fixed);
      if (!theme) { ok = false; err('TST1004', `${groupLabel(g)} has no theme "${s.fixed}" (themes: ${names.join(', ')})`); continue; }
      out.push({ group: g, fixed: theme });
      continue;
    }
    const dim = config.modes?.[s.dimension];
    if (!dim) {
      ok = false;
      err('TST1109', `${groupLabel(g)} is mapped to dimension "${s.dimension}", which config.modes does not declare`, 'Declare the dimension under "modes", or map the group to one that is declared.');
      continue;
    }
    if (usedDimensions.has(s.dimension)) {
      ok = false;
      err('TST1004', `two theme groups are mapped to dimension "${s.dimension}"`, 'Each theme group is one independent axis: map each to its own dimension, or fix all but one with "fixed".');
      continue;
    }
    usedDimensions.add(s.dimension);
    const map = [];
    const seenValues = new Map();
    for (const [themeName, value] of Object.entries(s.map ?? {})) {
      const theme = g.themes.find((t) => t.name === themeName);
      if (!theme) { ok = false; err('TST1004', `${groupLabel(g)} has no theme "${themeName}" (themes: ${names.join(', ')})`); continue; }
      if (!dim.values.includes(value)) {
        ok = false;
        err('TST1109', `theme "${themeName}" is mapped to "${s.dimension}: ${value}", which config.modes does not declare`);
        continue;
      }
      if (seenValues.has(value)) {
        ok = false;
        err('TST1004', `themes "${seenValues.get(value)}" and "${themeName}" are both mapped to "${s.dimension}: ${value}"`);
        continue;
      }
      seenValues.set(value, themeName);
      map.push([theme, value]);
    }
    for (const n of names) {
      if (!(n in (s.map ?? {}))) {
        ok = false;
        err('TST1004', `theme "${n}" of ${groupLabel(g)} is not mapped to a "${s.dimension}" value`, 'Map every theme of the group, or compile the group with one theme only ("fixed").');
      }
    }
    const def = dim.default ?? dim.values[0];
    if (!seenValues.has(def)) {
      ok = false;
      err('TST1004', `no theme of ${groupLabel(g)} is mapped to "${s.dimension}: ${def}", the dimension's default`, 'The default mode is the base every other mode overrides: map one theme to it.');
    }
    // Mode values in their declared order, so layers and combos are deterministic.
    map.sort((a, b) => dim.values.indexOf(a[1]) - dim.values.indexOf(b[1]));
    out.push({ group: g, dimension: s.dimension, default: def, map });
  }
  return ok ? out : null;
}

/** The sets a combination of themes uses, in resolution order. */
function activeSets(themes, order) {
  const status = new Map();
  for (const t of themes) {
    for (const [set, s] of Object.entries(t.selectedTokenSets ?? {})) {
      if (s === 'enabled') status.set(set, 'enabled');
      else if (s === 'source' && status.get(set) !== 'enabled') status.set(set, 'source');
    }
  }
  const byOrder = [...status.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return [...byOrder.filter((s) => status.get(s) === 'source'), ...byOrder.filter((s) => status.get(s) === 'enabled')];
}

const canonical = (node) => JSON.stringify([node.$type, node.$value]);

/** Build a DTCG tree from a flat path → token node map. Returns the clashing paths, if any. */
function treeOf(flat) {
  const tree = {};
  const clashes = [];
  for (const [p, node] of flat) {
    const keys = p.split('.');
    let at = tree;
    let ok = true;
    for (const k of keys.slice(0, -1)) {
      if (!(k in at)) at[k] = {};
      if ('$value' in at[k]) { clashes.push(p); ok = false; break; }
      at = at[k];
    }
    if (!ok) continue;
    const leaf = keys.at(-1);
    if (leaf in at) { clashes.push(p); continue; }
    at[leaf] = node;
  }
  return { tree, clashes };
}

/**
 * Load one `{ "tokensStudio": … }` entry. Returns the layers it lowers to
 * (possibly none, when the export is unusable; every reason is reported).
 */
export async function loadTokensStudio(cwd, entry, config, diagnostics) {
  const exp = await readExport(cwd, entry.tokensStudio, diagnostics);
  if (!exp) return [];
  const { rel, order } = exp;
  const setsByName = new Map(exp.sets.map((s) => [s.name, s]));

  // Themes: an export without any is one implicit theme using every set.
  let themes = exp.themes;
  if (!Array.isArray(themes)) {
    diagnostics.error('TST1003', `Tokens Studio export ${rel}: $themes is not a list of themes`);
    return [];
  }
  let themesOk = true;
  for (const t of themes) {
    if (!isPlainObject(t) || typeof t.name !== 'string' || !isPlainObject(t.selectedTokenSets)) {
      diagnostics.error('TST1003', `Tokens Studio export ${rel}: a theme has no "name" or no "selectedTokenSets"`);
      themesOk = false;
      continue;
    }
    for (const set of Object.keys(t.selectedTokenSets)) {
      if (t.selectedTokenSets[set] !== 'disabled' && !order.includes(set)) {
        diagnostics.error('TST1003', `Tokens Studio export ${rel}: theme "${t.name}" uses set "${set}", which is not in the set order`, {
          hint: 'Re-export from Tokens Studio, or remove the set from the theme.',
        });
        themesOk = false;
      }
    }
  }
  if (!themesOk) return [];
  if (themes.length === 0) {
    if (entry.themes !== undefined) {
      diagnostics.error('TST1004', `Tokens Studio export ${rel}: "themes" is configured, but the export has no themes`, { hint: 'Remove "themes" from the layer: every set is loaded, in set order.' });
      return [];
    }
    themes = [{ name: '(all sets)', selectedTokenSets: Object.fromEntries(order.map((s) => [s, 'enabled'])) }];
  }

  // 2. Dialect, per set.
  const tokensOfSet = new Map(); // set name → [[path, node]]
  for (const set of exp.sets) {
    if (needsStyleDictionaryMigration(set.tree)) {
      legacyToDtcg(set.tree);
      diagnostics.warn('TST1005', `${set.file}: legacy Tokens Studio format (value/type without "$") — read as DTCG`, {
        file: set.file,
        hint: 'Nothing to fix for the build. To silence it, switch the export to the "W3C DTCG" token format in Tokens Studio\'s settings.',
      });
    }
    const list = [];
    convertSet(set, diagnostics, (p, node) => list.push([p, node]));
    tokensOfSet.set(set.name, list);
  }

  // 3. Tiers: every original path → its placed path.
  const placed = new Map(); // original path → { path, tier, set }
  let tiersOk = true;
  for (const set of exp.sets) {
    const tier = tierOf(set, entry.sets);
    for (const [p] of tokensOfSet.get(set.name)) {
      const to = tier ? `${tier}.${p}` : p;
      const prev = placed.get(p);
      if (prev && prev.path !== to) {
        diagnostics.error('TST1008', `${p} is defined in set "${prev.set}" (placed as ${prev.path}) and in set "${set.name}" (placed as ${to}): a later set can only override it under the same tier`, {
          file: set.file,
          ...(set.at(p) ?? {}),
          hint: 'Place both sets under the same tier in the layer\'s "sets".',
        });
        tiersOk = false;
        continue;
      }
      if (!prev) placed.set(p, { path: to, set: set.name });
    }
  }
  if (!tiersOk) return [];
  const rewrite = (ref) => {
    let p = ref;
    if (!placed.has(p) && p.endsWith('.value') && placed.has(p.slice(0, -'.value'.length))) p = p.slice(0, -'.value'.length);
    return placed.get(p)?.path ?? p;
  };

  // Every token of every set at its placed path, with its origin.
  const setTokens = new Map(); // set name → Map(placed path → { node, origin })
  for (const set of exp.sets) {
    const tier = tierOf(set, entry.sets);
    const m = new Map();
    for (const [p, node] of tokensOfSet.get(set.name)) {
      const to = tier ? `${tier}.${p}` : p;
      node.$value = rewriteValue(node.$value, node.$type, rewrite);
      const pos = set.at(p) ?? {};
      m.set(to, { node, origin: { file: set.file, set: set.name, path: p, ...pos } });
    }
    setTokens.set(set.name, m);
  }

  // 4. Themes → dimensions, combinations, lowering.
  const groups = resolveGroups(groupThemes(themes), entry.themes, config, rel, diagnostics);
  if (!groups) return [];
  const flatOf = (chosen) => {
    const flat = new Map();
    for (const name of activeSets(chosen, order)) {
      for (const [p, t] of setTokens.get(name) ?? []) flat.set(p, t);
    }
    return flat;
  };
  const pick = (overrides = new Map()) =>
    groups.map((g) => overrides.get(g) ?? (g.fixed ?? g.map.find(([, v]) => v === g.default)[0]));
  const describe = (g, theme) => `${g.group.name === null ? 'theme' : `"${g.group.name}"`} = "${theme.name}"`;

  const base = flatOf(pick());
  const layers = [];
  const overlays = new Map(); // dimension → Map(value → flat)
  let lowerOk = true;
  for (const g of groups) {
    if (g.fixed) continue;
    overlays.set(g.dimension, new Map());
    for (const [theme, value] of g.map) {
      if (value === g.default) continue;
      const flat = flatOf(pick(new Map([[g, theme]])));
      const diff = new Map();
      for (const [p, t] of flat) {
        const b = base.get(p);
        if (!b) {
          diagnostics.error('TST1008', `${p} exists only when ${describe(g, theme)}: a mode can override a token, not add one`, {
            path: p,
            file: t.origin.file,
            ...(t.origin.line ? { line: t.origin.line, column: t.origin.column } : {}),
            hint: `Give ${t.origin.path} a value in a set the default theme uses too.`,
          });
          lowerOk = false;
          continue;
        }
        if (b.node.$type !== t.node.$type) {
          diagnostics.error('TST1008', `${p} is a ${b.node.$type ?? 'untyped'} token by default but a ${t.node.$type ?? 'untyped'} one when ${describe(g, theme)}`, { path: p, hint: 'Give the token one type in every set.' });
          lowerOk = false;
          continue;
        }
        if (canonical(b.node) !== canonical(t.node)) diff.set(p, t);
      }
      for (const [p] of base) {
        if (!flat.has(p)) {
          diagnostics.warn('TST1009', `${p} is in no set ${describe(g, theme)} uses — the default theme's value carries over to "${g.dimension}: ${value}"`, {
            path: p,
            hint: 'Add the token to a set the theme uses if it should differ, or enable its set in the theme.',
          });
        }
      }
      overlays.get(g.dimension).set(value, diff);
    }
  }

  // Combinations of two or more non-default themes: Transtyle applies each
  // dimension's overrides on their own (last declared dimension wins), so the
  // result must equal what Tokens Studio resolves for that combination.
  const mapped = groups.filter((g) => !g.fixed);
  const dimOrder = Object.keys(config.modes ?? {});
  const combos = mapped.reduce((acc, g) => acc.flatMap((c) => g.map.map(([theme, value]) => [...c, [g, theme, value]])), [[]]);
  for (const combo of combos) {
    const nonDefault = combo.filter(([g, , value]) => value !== g.default);
    if (nonDefault.length < 2) continue;
    const expected = flatOf(pick(new Map(combo.map(([g, theme]) => [g, theme]))));
    const composed = new Map(base);
    for (const [g, , value] of [...nonDefault].sort((a, b) => dimOrder.indexOf(a[0].dimension) - dimOrder.indexOf(b[0].dimension))) {
      for (const [p, t] of overlays.get(g.dimension)?.get(value) ?? []) composed.set(p, t);
    }
    const label = nonDefault.map(([g, theme]) => describe(g, theme)).join(' and ');
    for (const p of new Set([...expected.keys(), ...composed.keys()])) {
      const e = expected.get(p);
      const c = composed.get(p);
      if (e && c && canonical(e.node) === canonical(c.node)) continue;
      if (!e && !composed.has(p)) continue;
      if (!e) continue; // carried over: already a TST1009 for one of the themes
      diagnostics.error('TST1008', `${p}: with ${label}, Tokens Studio resolves ${JSON.stringify(e.node.$value)}, but one override per mode dimension gives ${c ? JSON.stringify(c.node.$value) : 'nothing'}`, {
        path: p,
        hint: 'Each theme group must change tokens independently of the others. Move the token into a set only one group controls, or fix one of the groups with "fixed".',
      });
      lowerOk = false;
    }
  }
  if (!lowerOk) return [];

  const layerOf = (flat, file, modeScope) => {
    const nodes = new Map();
    const positions = new Map();
    const origins = new Map();
    for (const [p, t] of flat) {
      nodes.set(p, t.node);
      origins.set(p, t.origin);
      if (t.origin.line) positions.set(p, { file: t.origin.file, line: t.origin.line, column: t.origin.column });
    }
    const { tree, clashes } = treeOf(nodes);
    for (const p of clashes) {
      diagnostics.error('TST1008', `${p} is a token in one set and a group in another`, { path: p, hint: 'Rename one of them: a token cannot have child tokens.' });
    }
    return { file, tree, modeScope, positions, origins };
  };
  layers.push(layerOf(base, rel, undefined));
  for (const g of groups) {
    if (g.fixed) continue;
    for (const [theme, value] of g.map) {
      if (value === g.default) continue;
      const diff = overlays.get(g.dimension).get(value);
      if (diff.size === 0) continue;
      layers.push(layerOf(diff, `${rel} (${describe(g, theme)})`, { [g.dimension]: value }));
    }
  }
  return layers;
}
